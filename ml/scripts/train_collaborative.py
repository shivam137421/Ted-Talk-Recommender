"""Train, evaluate, and export the collaborative filtering model for TalkWise."""

import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
import pandas as pd

# Add ml/src to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from talkwise_ml.evaluation.splits import per_user_train_val_test_split
from talkwise_ml.evaluation.metrics import evaluate_cohort
from talkwise_ml.collaborative.matrix import build_interaction_matrix
from talkwise_ml.collaborative.models import PopularityModel, ItemItemCosineCF, ImplicitALS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path("data/processed")
ARTIFACTS_DIR = Path("ml/artifacts/collaborative")


def evaluate_model_on_split(model, train_df: pd.DataFrame, target_df: pd.DataFrame, k_vals=(5, 10, 20)):
    """Evaluate any collaborative model on a target evaluation split."""
    # Build ground truth map: user_id -> list of target slugs
    ground_truth = target_df.groupby("user_id")["slug"].apply(list).to_dict()
    # Build history map from train
    user_train_history = train_df.groupby("user_id")["slug"].apply(list).to_dict()

    predictions = {}
    max_k = max(k_vals)

    for user_id, actual_slugs in ground_truth.items():
        history = user_train_history.get(user_id, [])
        recs = model.recommend(history, k=max_k, exclude_slugs=history)
        predictions[user_id] = [slug for slug, _ in recs]

    metrics = evaluate_cohort(ground_truth, predictions, k_values=k_vals)
    return metrics


def main():
    logger.info("=== Starting TalkWise Collaborative Filtering Pipeline ===")

    inter_path = DATA_DIR / "interactions.csv"
    talks_path = DATA_DIR / "talks_clean.csv"

    if not inter_path.exists() or not talks_path.exists():
        logger.error("Required processed files not found. Run build_dataset.py first.")
        sys.exit(1)

    interactions_df = pd.read_csv(inter_path)
    talks_df = pd.read_csv(talks_path)
    catalog_slugs = talks_df["slug"].tolist()

    logger.info("Loaded %d interactions across %d talks.", len(interactions_df), len(catalog_slugs))

    # 1. Train/Validation/Test Split (Users >= 5 favorites)
    logger.info("Step 1: Splitting user cohort (>= 5 favorites) into train/val/test...")
    train_df, val_df, test_df = per_user_train_val_test_split(
        interactions_df, min_favorites=5, val_ratio=0.1, test_ratio=0.2, random_state=42
    )

    logger.info("Split summary: Train=%d, Val=%d, Test=%d (Users=%d)",
                len(train_df), len(val_df), len(test_df), train_df["user_id"].nunique())

    # Build sparse matrix on train split
    train_matrix, u2i, i2u, slug_to_idx, idx_to_slug = build_interaction_matrix(
        train_df, catalog_slugs=catalog_slugs
    )
    logger.info("Train matrix shape: %s, non-zero entries: %d", train_matrix.shape, train_matrix.nnz)

    # 2. Hyperparameter Search / Candidate Comparison on Validation Split
    logger.info("Step 2: Comparing candidate algorithms on validation split...")
    candidate_results = {}

    # Candidate 1: Popularity Baseline
    logger.info("Evaluating Candidate 1: Popularity Baseline...")
    pop_model = PopularityModel()
    pop_model.fit(train_matrix, slug_to_idx, idx_to_slug)
    pop_val_metrics = evaluate_model_on_split(pop_model, train_df, val_df)
    candidate_results["Popularity"] = {"metrics": pop_val_metrics, "model": pop_model}
    logger.info("Popularity Val Metrics: %s", pop_val_metrics)

    # Candidate 2: Item-Item Cosine CF (top_k=50)
    logger.info("Evaluating Candidate 2: Item-Item Cosine CF (k=50)...")
    ii_50 = ItemItemCosineCF(top_k_neighbors=50)
    ii_50.fit(train_matrix, slug_to_idx, idx_to_slug)
    ii_50_metrics = evaluate_model_on_split(ii_50, train_df, val_df)
    candidate_results["ItemItem_Cosine_k50"] = {"metrics": ii_50_metrics, "model": ii_50}
    logger.info("Item-Item (k=50) Val Metrics: %s", ii_50_metrics)

    # Candidate 3: Item-Item Cosine CF (top_k=100)
    logger.info("Evaluating Candidate 3: Item-Item Cosine CF (k=100)...")
    ii_100 = ItemItemCosineCF(top_k_neighbors=100)
    ii_100.fit(train_matrix, slug_to_idx, idx_to_slug)
    ii_100_metrics = evaluate_model_on_split(ii_100, train_df, val_df)
    candidate_results["ItemItem_Cosine_k100"] = {"metrics": ii_100_metrics, "model": ii_100}
    logger.info("Item-Item (k=100) Val Metrics: %s", ii_100_metrics)

    # Candidate 4: Implicit ALS (32 factors, alpha=20)
    logger.info("Evaluating Candidate 4: Implicit ALS (32 factors, alpha=20, 8 iterations)...")
    als_32 = ImplicitALS(n_factors=32, regularization=0.05, alpha=20.0, n_iterations=8, random_state=42)
    als_32.fit(train_matrix, slug_to_idx, idx_to_slug)
    als_32_metrics = evaluate_model_on_split(als_32, train_df, val_df)
    candidate_results["ImplicitALS_f32_a20"] = {"metrics": als_32_metrics, "model": als_32}
    logger.info("Implicit ALS (f=32) Val Metrics: %s", als_32_metrics)

    # 3. Model Selection
    logger.info("\n=== Validation Results Summary Table ===")
    logger.info("%-25s | %-12s | %-12s | %-12s | %-12s",
                "Model", "Precision@10", "Recall@10", "MAP@10", "NDCG@10")
    logger.info("-" * 80)
    for name, res in candidate_results.items():
        m = res["metrics"]
        logger.info("%-25s | %-12.4f | %-12.4f | %-12.4f | %-12.4f",
                    name, m["Precision@10"], m["Recall@10"], m["MAP@10"], m["NDCG@10"])

    # Best model chosen by NDCG@10 on validation split
    best_name = max(candidate_results, key=lambda k: candidate_results[k]["metrics"]["NDCG@10"])
    best_candidate = candidate_results[best_name]
    logger.info("\nSelected Best Model: %s (NDCG@10 = %.4f)",
                best_name, best_candidate["metrics"]["NDCG@10"])

    # 4. Save Artifacts
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    model_artifact_path = ARTIFACTS_DIR / "collaborative_model.joblib"
    metadata_path = ARTIFACTS_DIR / "metadata.json"

    selected_model = best_candidate["model"]
    logger.info("Saving selected model to %s...", model_artifact_path)
    joblib.dump(selected_model, model_artifact_path, compress=3)

    artifact_size_mb = model_artifact_path.stat().st_size / (1024 * 1024)
    logger.info("Saved artifact size: %.2f MB", artifact_size_mb)

    metadata = {
        "model_name": best_name,
        "algorithm_class": selected_model.__class__.__name__,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version,
        "training_users_count": train_matrix.shape[0],
        "catalog_items_count": train_matrix.shape[1],
        "training_interactions_count": int(train_matrix.nnz),
        "validation_metrics": best_candidate["metrics"],
        "artifact_size_mb": round(artifact_size_mb, 4),
        "parameters": getattr(selected_model, "__dict__", {})
    }
    # Clean non-serializable parameters from metadata
    clean_params = {}
    for k, v in metadata["parameters"].items():
        if isinstance(v, (int, float, str, bool, list)):
            clean_params[k] = v
    metadata["parameters"] = clean_params

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    logger.info("Saved metadata to %s.", metadata_path)

    # 5. Sanity Test Inference
    sample_favs = ["ken_robinson_says_schools_kill_creativity", "jill_bolte_taylor_s_powerful_stroke_of_insight"]
    logger.info("\nTesting recommendation fold-in on sample user history: %s", sample_favs)
    sample_recs = selected_model.recommend(sample_favs, k=5)
    for rank, (slug, score) in enumerate(sample_recs, 1):
        logger.info("  %d. %s (Score: %.4f)", rank, slug, score)

    logger.info("=== Collaborative Filtering Pipeline Completed Successfully ===")


if __name__ == "__main__":
    main()

