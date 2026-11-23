"""Talk metadata cleaning and transcript merging pipeline."""

import ast
import html
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

import pandas as pd

from .slug import extract_canonical_slug, normalize_text

logger = logging.getLogger(__name__)


def parse_timestamp_to_iso(ts_val) -> Optional[str]:
    """Safely convert a Unix timestamp to ISO 8601 string (YYYY-MM-DD)."""
    if pd.isna(ts_val):
        return None
    try:
        # In ted_main, timestamps are seconds since epoch
        ts_int = int(ts_val)
        dt = datetime.fromtimestamp(ts_int, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def parse_tags_list(tags_val) -> list:
    """Safely parse tags column from string representation to a list of clean strings."""
    if pd.isna(tags_val):
        return []
    if isinstance(tags_val, list):
        return [str(t).strip() for t in tags_val if str(t).strip()]
    if isinstance(tags_val, str):
        try:
            parsed = ast.literal_eval(tags_val)
            if isinstance(parsed, list):
                return [str(t).strip() for t in parsed if str(t).strip()]
        except Exception:
            # Fallback: simple split
            cleaned = tags_val.strip("[]'\" ")
            return [t.strip().strip("'\"") for t in cleaned.split(",") if t.strip()]
    return []


def clean_talks_dataset(
    ted_main_path: Path,
    transcripts_path: Path
) -> pd.DataFrame:
    """Load, clean, standardize, and merge TED Talks metadata with transcripts."""
    logger.info("Loading raw datasets from %s and %s", ted_main_path, transcripts_path)
    df_main = pd.read_csv(ted_main_path)
    df_trans = pd.read_csv(transcripts_path)

    # 1. Canonical Slug Extraction
    df_main["slug"] = df_main["url"].apply(extract_canonical_slug)
    df_trans["slug"] = df_trans["url"].apply(extract_canonical_slug)

    # Deduplicate transcripts by slug (keep first complete transcript)
    df_trans_dedup = df_trans.sort_values(
        by="transcript", key=lambda s: s.str.len(), ascending=False
    ).drop_duplicates(subset=["slug"], keep="first")

    # 2. Text sanitization (HTML unescape and whitespace stripping)
    df_main["title"] = df_main["title"].apply(lambda t: html.unescape(str(t)).strip() if pd.notna(t) else "")
    df_main["description"] = df_main["description"].apply(lambda d: html.unescape(str(d)).strip() if pd.notna(d) else "")
    df_main["main_speaker"] = df_main["main_speaker"].apply(lambda s: html.unescape(str(s)).strip() if pd.notna(s) else "Unknown")
    df_main["speaker_occupation"] = df_main["speaker_occupation"].fillna("Unknown").apply(lambda s: html.unescape(str(s)).strip())

    # 3. Formatted dates and numbers
    df_main["published_at"] = df_main["published_date"].apply(parse_timestamp_to_iso)
    df_main["film_date_iso"] = df_main["film_date"].apply(parse_timestamp_to_iso)
    df_main["duration_seconds"] = pd.to_numeric(df_main["duration"], errors="coerce").fillna(0).astype(int)
    df_main["views"] = pd.to_numeric(df_main["views"], errors="coerce").fillna(0).astype(int)
    df_main["comments_count"] = pd.to_numeric(df_main["comments"], errors="coerce").fillna(0).astype(int)

    # 4. Tags standardization
    df_main["parsed_tags"] = df_main["tags"].apply(parse_tags_list)
    df_main["tags_json"] = df_main["parsed_tags"].apply(json.dumps)

    # 5. Merge Transcripts
    merged = pd.merge(
        df_main,
        df_trans_dedup[["slug", "transcript"]],
        on="slug",
        how="left"
    )
    merged["transcript"] = merged["transcript"].fillna("").apply(lambda t: html.unescape(str(t)).strip())
    merged["has_transcript"] = merged["transcript"].apply(lambda t: len(t) > 0)

    # 6. Canonical URLs
    merged["canonical_url"] = merged["slug"].apply(lambda s: f"https://www.ted.com/talks/{s}")

    # Build composite text for NLP
    merged["combined_text"] = (
        merged["title"] + " " +
        merged["main_speaker"] + " " +
        merged["description"] + " " +
        merged["parsed_tags"].apply(lambda tags: " ".join(tags)) + " " +
        merged["transcript"]
    ).str.strip()

    # Default has_interactions to False (updated during interaction matching)
    merged["has_interactions"] = False

    return merged

