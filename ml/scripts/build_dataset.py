"""Main ETL Script to build and validate TalkWise processed datasets."""

import hashlib
import json
import logging
import sys
from pathlib import Path

# Add ml/src to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from talkwise_ml.preprocessing.cleaner import clean_talks_dataset
from talkwise_ml.preprocessing.matcher import build_interactions_dataset

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RAW_DIR = Path("data")
IDIAP_DIR = Path("data/TED_dataset")
PROCESSED_DIR = Path("data/processed")


def compute_sha256(path: Path) -> str:
    """Compute sha256 checksum of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(8192 * 1024):
            h.update(chunk)
    return h.hexdigest()


def main():
    logger.info("=== Starting TalkWise Dataset Build Pipeline ===")

    ted_main_path = RAW_DIR / "ted_main.csv"
    transcripts_path = RAW_DIR / "transcripts.csv"
    idiap_talks_path = IDIAP_DIR / "ted_talks-10-Sep-2012.json"
    idiap_users_path = IDIAP_DIR / "ted_users-10-Sep-2012.json"

    # Verify input files exist
    for p in [ted_main_path, transcripts_path, idiap_talks_path, idiap_users_path]:
        if not p.exists():
            logger.error("Required raw file not found: %s", p)
            sys.exit(1)

    # 1. Clean Talks & Merge Transcripts
    logger.info("Step 1: Cleaning talks catalog and merging transcripts...")
    talks_df = clean_talks_dataset(ted_main_path, transcripts_path)
    logger.info("Catalog shape after cleaning: %s", talks_df.shape)

    # 2. Build User Interactions & Match Slugs
    logger.info("Step 2: Processing Idiap user interactions...")
    interactions_df, talks_df_updated, stats = build_interactions_dataset(
        idiap_talks_path, idiap_users_path, talks_df
    )
    logger.info("Deduplicated interactions count: %d", len(interactions_df))
    logger.info("Stats: %s", json.dumps(stats, indent=2))

    # 3. Create Slug Mapping (canonical slug -> integer index 0..N-1)
    # Sort talks deterministically by slug for absolute reproducibility
    talks_df_sorted = talks_df_updated.sort_values(by="slug").reset_index(drop=True)
    slug_to_idx = {slug: i for i, slug in enumerate(talks_df_sorted["slug"])}
    idx_to_slug = {i: slug for i, slug in enumerate(talks_df_sorted["slug"])}

    # Ensure processed directory exists
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    # 4. Save Processed Datasets
    talks_out_path = PROCESSED_DIR / "talks_clean.csv"
    interactions_out_path = PROCESSED_DIR / "interactions.csv"
    mapping_out_path = PROCESSED_DIR / "slug_mapping.json"
    stats_out_path = PROCESSED_DIR / "dataset_stats.json"

    logger.info("Writing clean talks to %s...", talks_out_path)
    talks_df_sorted.to_csv(talks_out_path, index=False)

    logger.info("Writing interactions to %s...", interactions_out_path)
    interactions_df.to_csv(interactions_out_path, index=False)

    logger.info("Writing slug mapping to %s...", mapping_out_path)
    with open(mapping_out_path, "w", encoding="utf-8") as f:
        json.dump({
            "slug_to_idx": slug_to_idx,
            "idx_to_slug": idx_to_slug,
            "total_talks": len(talks_df_sorted)
        }, f, indent=2)

    logger.info("Writing dataset stats to %s...", stats_out_path)
    with open(stats_out_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    # 5. Compute output checksums
    talks_hash = compute_sha256(talks_out_path)
    interactions_hash = compute_sha256(interactions_out_path)
    logger.info("Output Checksums:")
    logger.info("  talks_clean.csv: %s", talks_hash)
    logger.info("  interactions.csv: %s", interactions_hash)
    logger.info("=== Dataset Build Pipeline Completed Successfully ===")


if __name__ == "__main__":
    main()

