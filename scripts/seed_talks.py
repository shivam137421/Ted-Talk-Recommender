"""Idempotent database seeding script to populate talks catalog into Supabase Postgres."""

import json
import logging
import os
import sys
from pathlib import Path
from typing import List, Dict

import pandas as pd
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROCESSED_TALKS_PATH = Path("data/processed/talks_clean.csv")


def seed_talks():
    supabase_url = os.environ.get("SUPABASE_URL", "https://lnrhliamfervhrbxzaxj.supabase.co").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not service_role_key:
        env_path = Path("backend/.env")
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                    service_role_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

    if not service_role_key:
        logger.error("SUPABASE_SERVICE_ROLE_KEY is required to seed talks into Supabase.")
        logger.info("Set SUPABASE_SERVICE_ROLE_KEY in backend/.env and re-run.")
        sys.exit(1)

    if not PROCESSED_TALKS_PATH.exists():
        logger.error("Clean talks file not found at %s. Run build_dataset.py first.", PROCESSED_TALKS_PATH)
        sys.exit(1)

    df = pd.read_csv(PROCESSED_TALKS_PATH)
    logger.info("Loaded %d clean talks from %s.", len(df), PROCESSED_TALKS_PATH)

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    endpoint = f"{supabase_url}/rest/v1/talks?on_conflict=slug"
    batch_size = 100
    total_seeded = 0

    for start_idx in range(0, len(df), batch_size):
        end_idx = min(start_idx + batch_size, len(df))
        batch_df = df.iloc[start_idx:end_idx]

        payload = []
        for _, row in batch_df.iterrows():
            payload.append({
                "slug": str(row["slug"]),
                "title": str(row["title"]),
                "speaker": str(row["main_speaker"]),
                "speaker_occupation": None if pd.isna(row["speaker_occupation"]) else str(row["speaker_occupation"]),
                "description": str(row["description"]),
                "tags": json.loads(row["tags_json"]) if pd.notna(row["tags_json"]) else [],
                "views": int(row["views"]),
                "duration_seconds": int(row["duration_seconds"]),
                "published_at": None if pd.isna(row["published_at"]) else str(row["published_at"]),
                "film_date": None if pd.isna(row["film_date_iso"]) else str(row["film_date_iso"]),
                "event": None if pd.isna(row["event"]) else str(row["event"]),
                "ted_url": str(row["canonical_url"]),
                "has_transcript": bool(row["has_transcript"]),
                "has_interactions": bool(row["has_interactions"])
            })

        response = requests.post(endpoint, headers=headers, json=payload, timeout=30)
        if response.status_code not in (200, 201):
            logger.error("Failed to seed batch %d-%d: HTTP %d - %s",
                         start_idx, end_idx, response.status_code, response.text)
            sys.exit(1)

        total_seeded += len(payload)
        logger.info("Seeded %d / %d talks...", total_seeded, len(df))

    logger.info("Successfully seeded %d talks into Supabase!", total_seeded)


if __name__ == "__main__":
    seed_talks()

