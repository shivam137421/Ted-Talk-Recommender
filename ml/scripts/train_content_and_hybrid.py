"""Fit unsupervised TF-IDF feature pipeline and export compact content artifacts."""

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from scipy.sparse import save_npz

# Add ml/src to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from talkwise_ml.content.vectorizer import fit_content_tfidf
from talkwise_ml.content.model import ContentBasedRecommender

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROCESSED_DIR = Path("data/processed")
ARTIFACTS_DIR = Path("ml/artifacts/content")


def main():
    logger.info("=== Starting TalkWise Content Feature Pipeline ===")
    talks_path = PROCESSED_DIR / "talks_clean.csv"
    mapping_path = PROCESSED_DIR / "slug_mapping.json"

    if not talks_path.exists() or not mapping_path.exists():
        logger.error("Required processed files not found. Run build_dataset.py first.")
        sys.exit(1)

    talks_df = pd.read_csv(talks_path)
    with open(mapping_path, "r", encoding="utf-8") as f:
        mapping_data = json.load(f)
    slug_to_idx = mapping_data["slug_to_idx"]
    idx_to_slug = {int(k): v for k, v in mapping_data["idx_to_slug"].items()}

    logger.info("Loaded catalog of %d talks.", len(talks_df))

    # 1. Fit unsupervised TF-IDF
    logger.info("Fitting TF-IDF vectorizer on weighted talk text corpus...")
    vectorizer, tfidf_matrix = fit_content_tfidf(
        talks_df=talks_df,
        max_features=12000,
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.90
    )
    logger.info("TF-IDF matrix shape: %s, non-zero entries: %d", tfidf_matrix.shape, tfidf_matrix.nnz)

    # 2. Build Content-Based Recommender and Precompute Compact Neighbors
    logger.info("Building Content-Based Model and precomputing top-50 neighbor tables...")
    talk_tags_map = {row["slug"]: json.loads(row["tags_json"]) for _, row in talks_df.iterrows()}

    content_model = ContentBasedRecommender(
        tfidf_matrix=tfidf_matrix,
        slug_to_idx=slug_to_idx,
        idx_to_slug=idx_to_slug,
        vectorizer=vectorizer,
        talk_tags_map=talk_tags_map,
        top_k_neighbors=50
    )

    # 3. Export Artifacts
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    vec_path = ARTIFACTS_DIR / "tfidf_vectorizer.joblib"
    matrix_path = ARTIFACTS_DIR / "tfidf_matrix.npz"
    nbrs_path = ARTIFACTS_DIR / "content_neighbors.joblib"
    meta_path = ARTIFACTS_DIR / "metadata.json"

    logger.info("Saving TF-IDF vectorizer to %s...", vec_path)
    joblib.dump(vectorizer, vec_path, compress=3)

    logger.info("Saving sparse TF-IDF matrix to %s...", matrix_path)
    save_npz(matrix_path, tfidf_matrix)

    logger.info("Saving compact neighbor tables to %s...", nbrs_path)
    joblib.dump({
        "neighbor_indices": content_model.neighbor_indices,
        "neighbor_scores": content_model.neighbor_scores,
        "top_k_neighbors": 50
    }, nbrs_path, compress=3)

    vec_size_mb = vec_path.stat().st_size / (1024 * 1024)
    mat_size_mb = matrix_path.stat().st_size / (1024 * 1024)
    nbr_size_mb = nbrs_path.stat().st_size / (1024 * 1024)
    total_size_mb = vec_size_mb + mat_size_mb + nbr_size_mb

    logger.info("Content Artifact Sizes: Vectorizer=%.2f MB, Matrix=%.2f MB, Neighbors=%.2f MB (Total: %.2f MB)",
                vec_size_mb, mat_size_mb, nbr_size_mb, total_size_mb)

    metadata = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version,
        "catalog_size": len(talks_df),
        "vocab_size": tfidf_matrix.shape[1],
        "non_zeros": int(tfidf_matrix.nnz),
        "total_artifact_size_mb": round(total_size_mb, 4),
        "field_weights": {
            "title": 3.0,
            "tags": 2.0,
            "speaker": 2.0,
            "description": 1.5,
            "transcript": 1.0
        }
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    logger.info("Saved metadata to %s.", meta_path)

    # Sanity check recommendation
    sample_fav = "ken_robinson_says_schools_kill_creativity"
    recs = content_model.recommend([sample_fav], k=5)
    logger.info("\nSanity check Content Recs for '%s':", sample_fav)
    for rank, (slug, score) in enumerate(recs, 1):
        logger.info("  %d. %s (Cosine Sim: %.4f)", rank, slug, score)

    logger.info("=== Content Feature Pipeline Completed Successfully ===")


if __name__ == "__main__":
    main()

