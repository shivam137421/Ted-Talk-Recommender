"""Comprehensive evaluation benchmark comparing Random, Popularity, Content, CF, and Hybrid."""

import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Set, Tuple

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.sparse import load_npz

# Add ml/src to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from talkwise_ml.evaluation.splits import per_user_holdout_split
from talkwise_ml.evaluation.metrics import evaluate_cohort
from talkwise_ml.collaborative.matrix import build_interaction_matrix
from talkwise_ml.collaborative.models import PopularityModel, ItemItemCosineCF
from talkwise_ml.content.model import ContentBasedRecommender
from talkwise_ml.hybrid.scorer import HybridRecommender

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROCESSED_DIR = Path("data/processed")
CONTENT_ART_DIR = Path("ml/artifacts/content")
REPORTS_DIR = Path("reports")
FIGURES_DIR = Path("reports/figures")


class RandomModel:
    """Random baseline for recommendation ranking."""

    def __init__(self, catalog_slugs: List[str], seed: int = 42):
        self.catalog_slugs = catalog_slugs
        self.rng = np.random.RandomState(seed)

    def recommend(self, favorite_slugs: List[str], k: int = 10, exclude_slugs: List[str] = None):
        banned = set(favorite_slugs)
        if exclude_slugs:
            banned.update(exclude_slugs)
        candidates = [s for s in self.catalog_slugs if s not in banned]
        chosen = self.rng.choice(candidates, size=min(k, len(candidates)), replace=False)
        return [(s, 1.0) for s in chosen]


def run_single_seed_evaluation(
    interactions_df: pd.DataFrame,
    talks_df: pd.DataFrame,
    content_model: ContentBasedRecommender,
    seed: int,
    k_vals=(5, 10, 20),
    sample_eval_users: int = 1000
) -> Dict[str, Dict[str, float]]:
    """Run full evaluation on a single deterministic seed split."""
    logger.info("Splitting dataset with seed=%d...", seed)
    train_df, test_df = per_user_holdout_split(
        interactions_df, min_favorites=5, test_ratio=0.2, random_state=seed
    )

    catalog_slugs = talks_df["slug"].tolist()

    # Build train interaction matrix
    train_matrix, u2i, i2u, slug_to_idx, idx_to_slug = build_interaction_matrix(
        train_df, catalog_slugs=catalog_slugs
    )

    # Initialize models on train split
    pop_model = PopularityModel()
    pop_model.fit(train_matrix, slug_to_idx, idx_to_slug)

    cf_model = ItemItemCosineCF(top_k_neighbors=50)
    cf_model.fit(train_matrix, slug_to_idx, idx_to_slug)

    talk_metadata_map = {
        row["slug"]: {
            "title": row["title"],
            "tags": json.loads(row["tags_json"])
        }
        for _, row in talks_df.iterrows()
    }

    hybrid_model = HybridRecommender(
        content_model=content_model,
        collaborative_model=cf_model,
        popularity_model=pop_model,
        talk_metadata_map=talk_metadata_map
    )

    random_model = RandomModel(catalog_slugs, seed=seed)

    models = {
        "Random": random_model,
        "Popularity": pop_model,
        "Content-Based": content_model,
        "Collaborative": cf_model,
        "Hybrid": hybrid_model
    }

    # Evaluate on a representative sample of test users for speed across 5 seeds
    ground_truth_all = test_df.groupby("user_id")["slug"].apply(list).to_dict()
    user_train_history_all = train_df.groupby("user_id")["slug"].apply(list).to_dict()

    eval_users = sorted(list(ground_truth_all.keys()))
    if sample_eval_users and len(eval_users) > sample_eval_users:
        rng = np.random.RandomState(seed)
        eval_users = list(rng.choice(eval_users, size=sample_eval_users, replace=False))

    ground_truth = {u: ground_truth_all[u] for u in eval_users}
    user_train_history = {u: user_train_history_all.get(u, []) for u in eval_users}

    seed_metrics = {}
    max_k = max(k_vals)

    for model_name, model in models.items():
        predictions = {}
        all_recommended_items: Set[str] = set()

        for user_id in eval_users:
            history = user_train_history.get(user_id, [])
            if model_name == "Hybrid":
                recs = model.recommend(favorite_slugs=history, k=max_k, exclude_slugs=history)
                rec_slugs = [r["slug"] for r in recs]
            elif model_name == "Content-Based":
                recs = model.recommend(favorite_slugs=history, k=max_k, exclude_slugs=history)
                rec_slugs = [slug for slug, _ in recs]
            else:
                recs = model.recommend(favorite_slugs=history, k=max_k, exclude_slugs=history)
                rec_slugs = [slug for slug, _ in recs]

            predictions[user_id] = rec_slugs
            all_recommended_items.update(rec_slugs)

        metrics = evaluate_cohort(ground_truth, predictions, k_values=k_vals)
        # Catalog coverage: percentage of catalog talks recommended at least once
        metrics["Catalog_Coverage@20"] = round(len(all_recommended_items) / len(catalog_slugs), 4)
        seed_metrics[model_name] = metrics

    return seed_metrics


def run_cold_start_experiments(
    interactions_df: pd.DataFrame,
    talks_df: pd.DataFrame,
    content_model: ContentBasedRecommender,
    seed: int = 42
) -> Dict[str, Dict]:
    """Execute dedicated experiments for item cold-start and cold users."""
    logger.info("Executing Item Cold-Start and Cold-User experiments...")

    catalog_slugs = talks_df["slug"].tolist()
    train_df, test_df = per_user_holdout_split(interactions_df, min_favorites=5, random_state=seed)

    # 1. Item Cold-Start Experiment:
    # Identify active items, hold out 10% of them completely from training interactions
    active_items = sorted(train_df["slug"].unique())
    rng = np.random.RandomState(seed)
    n_cold = int(len(active_items) * 0.10)
    cold_items = set(rng.choice(active_items, size=n_cold, replace=False))

    # Mask cold items from train
    masked_train_df = train_df[~train_df["slug"].isin(cold_items)]
    train_matrix, _, _, slug_to_idx, idx_to_slug = build_interaction_matrix(
        masked_train_df, catalog_slugs=catalog_slugs
    )

    pop_model = PopularityModel()
    pop_model.fit(train_matrix, slug_to_idx, idx_to_slug)
    cf_model = ItemItemCosineCF(top_k_neighbors=50)
    cf_model.fit(train_matrix, slug_to_idx, idx_to_slug)
    hybrid_model = HybridRecommender(content_model, cf_model, pop_model)

    # Test users who actually favorited cold items in test set
    test_cold_ground_truth = {}
    for user_id, group in test_df.groupby("user_id"):
        cold_actual = [s for s in group["slug"] if s in cold_items]
        if cold_actual:
            test_cold_ground_truth[user_id] = cold_actual

    cold_item_eval = {}
    for model_name, model in [("Popularity", pop_model), ("CF", cf_model), ("Content", content_model), ("Hybrid", hybrid_model)]:
        preds = {}
        for u in test_cold_ground_truth:
            hist = masked_train_df[masked_train_df["user_id"] == u]["slug"].tolist()
            if model_name == "Hybrid":
                r = model.recommend(favorite_slugs=hist, k=20, exclude_slugs=hist)
                preds[u] = [item["slug"] for item in r]
            else:
                r = model.recommend(favorite_slugs=hist, k=20, exclude_slugs=hist)
                preds[u] = [slug for slug, _ in r]
        cold_item_eval[model_name] = evaluate_cohort(test_cold_ground_truth, preds, k_values=[10, 20])

    # 2. Cold-User Experiment (users with only 1-2 favorites)
    user_counts = interactions_df.groupby("user_id")["slug"].count()
    cold_users = user_counts[(user_counts >= 2) & (user_counts <= 3)].index[:500]
    cold_user_df = interactions_df[interactions_df["user_id"].isin(cold_users)]
    
    cold_user_train = []
    cold_user_test = {}
    for u, grp in cold_user_df.groupby("user_id"):
        items = grp["slug"].tolist()
        cold_user_train.append((u, items[0], 1))
        cold_user_test[u] = items[1:]

    cold_user_train_df = pd.DataFrame(cold_user_train, columns=["user_id", "slug", "signal"])
    cold_user_eval = {}
    for model_name, model in [("Popularity", pop_model), ("CF", cf_model), ("Content", content_model), ("Hybrid", hybrid_model)]:
        preds = {}
        for u in cold_user_test:
            hist = [cold_user_train_df[cold_user_train_df["user_id"] == u]["slug"].iloc[0]]
            if model_name == "Hybrid":
                r = model.recommend(favorite_slugs=hist, k=20, exclude_slugs=hist)
                preds[u] = [item["slug"] for item in r]
            else:
                r = model.recommend(favorite_slugs=hist, k=20, exclude_slugs=hist)
                preds[u] = [slug for slug, _ in r]
        cold_user_eval[model_name] = evaluate_cohort(cold_user_test, preds, k_values=[10, 20])

    return {"item_cold_start": cold_item_eval, "cold_users": cold_user_eval}


def generate_evaluation_plots(aggregated_results: Dict[str, Dict[str, float]]):
    """Generate professional comparative plots saved to reports/figures/."""
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    models = ["Random", "Popularity", "Content-Based", "Collaborative", "Hybrid"]

    # 1. NDCG@K Comparison Plot
    fig, ax = plt.subplots(figsize=(10, 6))
    x = np.arange(len(models))
    width = 0.25

    ndcg5 = [aggregated_results[m]["NDCG@5_mean"] for m in models]
    ndcg10 = [aggregated_results[m]["NDCG@10_mean"] for m in models]
    ndcg20 = [aggregated_results[m]["NDCG@20_mean"] for m in models]

    ax.bar(x - width, ndcg5, width, label="NDCG@5", color="#B8860B")
    ax.bar(x, ndcg10, width, label="NDCG@10", color="#C8102E")
    ax.bar(x + width, ndcg20, width, label="NDCG@20", color="#2F4F4F")

    ax.set_ylabel("NDCG Score", fontsize=12)
    ax.set_title("Recommendation Ranking Quality (NDCG@K) Across Models", fontsize=14, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(models, fontsize=11)
    ax.legend(frameon=True)
    ax.grid(axis="y", linestyle="--", alpha=0.5)

    plot_path1 = FIGURES_DIR / "model_comparison_ndcg.png"
    plt.tight_layout()
    plt.savefig(plot_path1, dpi=300)
    plt.close()

    # 2. Precision@10 vs Recall@10 Trade-off Plot
    fig, ax = plt.subplots(figsize=(8, 6))
    colors = {"Random": "gray", "Popularity": "orange", "Content-Based": "blue", "Collaborative": "purple", "Hybrid": "red"}
    
    for m in models:
        p = aggregated_results[m]["Precision@10_mean"]
        r = aggregated_results[m]["Recall@10_mean"]
        ax.scatter(r, p, color=colors[m], s=160, label=m, zorder=5)
        ax.annotate(m, (r + 0.003, p + 0.0005), fontsize=10)

    ax.set_xlabel("Recall@10", fontsize=12)
    ax.set_ylabel("Precision@10", fontsize=12)
    ax.set_title("Precision@10 vs Recall@10 Comparison", fontsize=14, fontweight="bold")
    ax.grid(True, linestyle="--", alpha=0.5)
    ax.legend(loc="upper left")

    plot_path2 = FIGURES_DIR / "precision_recall_tradeoff.png"
    plt.tight_layout()
    plt.savefig(plot_path2, dpi=300)
    plt.close()
    logger.info("Saved evaluation plots to %s and %s", plot_path1, plot_path2)


def main():
    logger.info("=== Starting TalkWise Full Multi-Seed Model Evaluation ===")

    inter_path = PROCESSED_DIR / "interactions.csv"
    talks_path = PROCESSED_DIR / "talks_clean.csv"
    matrix_path = CONTENT_ART_DIR / "tfidf_matrix.npz"
    mapping_path = PROCESSED_DIR / "slug_mapping.json"
    vec_path = CONTENT_ART_DIR / "tfidf_vectorizer.joblib"

    interactions_df = pd.read_csv(inter_path)
    talks_df = pd.read_csv(talks_path)
    tfidf_matrix = load_npz(matrix_path)
    vectorizer = joblib.load(vec_path)

    with open(mapping_path, "r", encoding="utf-8") as f:
        mapping = json.load(f)
    slug_to_idx = mapping["slug_to_idx"]
    idx_to_slug = {int(k): v for k, v in mapping["idx_to_slug"].items()}

    content_model = ContentBasedRecommender(
        tfidf_matrix=tfidf_matrix,
        slug_to_idx=slug_to_idx,
        idx_to_slug=idx_to_slug,
        vectorizer=vectorizer,
        top_k_neighbors=50
    )

    # 5 Fixed Seeds for Statistical Rigor
    seeds = [42, 43, 44, 45, 46]
    all_seed_results = {s: run_single_seed_evaluation(interactions_df, talks_df, content_model, seed=s) for s in seeds}

    # Aggregate Mean and Standard Deviation across seeds
    models = ["Random", "Popularity", "Content-Based", "Collaborative", "Hybrid"]
    sample_metrics_keys = list(all_seed_results[seeds[0]][models[0]].keys())

    aggregated = {}
    for m in models:
        aggregated[m] = {}
        for metric in sample_metrics_keys:
            vals = [all_seed_results[s][m][metric] for s in seeds]
            aggregated[m][f"{metric}_mean"] = round(float(np.mean(vals)), 4)
            aggregated[m][f"{metric}_std"] = round(float(np.std(vals)), 4)

    # Run Cold-Start & Cold-User Experiments
    cold_results = run_cold_start_experiments(interactions_df, talks_df, content_model, seed=42)

    # Generate Plots
    generate_evaluation_plots(aggregated)

    # Save JSON results
    output_json_path = REPORTS_DIR / "evaluation_results.json"
    full_output = {
        "evaluation_timestamp": datetime.now(timezone.utc).isoformat(),
        "seeds": seeds,
        "sample_eval_cohort_size": 1000,
        "total_catalog_size": len(talks_df),
        "aggregated_metrics": aggregated,
        "cold_start_experiments": cold_results,
        "per_seed_raw_metrics": all_seed_results
    }
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(full_output, f, indent=2)

    logger.info("Saved comprehensive evaluation results to %s.", output_json_path)

    # Print Formatted Comparison Table
    logger.info("\n" + "=" * 90)
    logger.info("FINAL MULTI-SEED EVALUATION RESULTS (MEAN ± STD)")
    logger.info("=" * 90)
    logger.info("%-16s | %-16s | %-16s | %-16s | %-16s",
                "Model", "Precision@10", "Recall@10", "NDCG@10", "Catalog Coverage")
    logger.info("-" * 90)
    for m in models:
        p10 = f"{aggregated[m]['Precision@10_mean']:.4f}±{aggregated[m]['Precision@10_std']:.4f}"
        r10 = f"{aggregated[m]['Recall@10_mean']:.4f}±{aggregated[m]['Recall@10_std']:.4f}"
        n10 = f"{aggregated[m]['NDCG@10_mean']:.4f}±{aggregated[m]['NDCG@10_std']:.4f}"
        cov = f"{aggregated[m]['Catalog_Coverage@20_mean'] * 100:.1f}%"
        logger.info("%-16s | %-16s | %-16s | %-16s | %-16s", m, p10, r10, n10, cov)
    logger.info("=" * 90)


if __name__ == "__main__":
    main()

