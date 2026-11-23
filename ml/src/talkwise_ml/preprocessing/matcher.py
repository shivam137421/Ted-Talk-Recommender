"""Interaction dataset builder and cross-dataset talk matching pipeline."""

import json
import logging
from collections import Counter
from pathlib import Path
from typing import Dict, List, Set, Tuple

import pandas as pd

from .slug import extract_canonical_slug, normalize_text

logger = logging.getLogger(__name__)


def build_interactions_dataset(
    idiap_talks_path: Path,
    idiap_users_path: Path,
    talks_df: pd.DataFrame
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict]:
    """Parse user interactions from Idiap JSON and map them deterministically to talks_df by slug."""
    logger.info("Loading Idiap JSON datasets from %s and %s", idiap_talks_path, idiap_users_path)
    with open(idiap_talks_path, "r", encoding="utf-8", errors="replace") as f:
        idiap_talks = json.load(f)
    with open(idiap_users_path, "r", encoding="utf-8", errors="replace") as f:
        idiap_users = json.load(f)

    # 1. Build lookup tables for Idiap talks
    idiap_title_to_slug: Dict[str, str] = {}
    idiap_norm_title_to_slug: Dict[str, str] = {}

    for t in idiap_talks:
        raw_t = t.get("title", "")
        title_str = raw_t[0] if isinstance(raw_t, list) and raw_t else str(raw_t)
        title_clean = title_str.strip()
        slug = extract_canonical_slug(t.get("url", ""))

        if slug:
            idiap_title_to_slug[title_clean] = slug
            idiap_norm_title_to_slug[normalize_text(title_clean)] = slug

    # 2. Build lookup tables for talks_df
    catalog_slugs: Set[str] = set(talks_df["slug"])
    name_to_slug: Dict[str, str] = {}
    title_to_slug: Dict[str, str] = {}

    for _, row in talks_df.iterrows():
        s = row["slug"]
        if "name" in row and pd.notna(row["name"]):
            name_to_slug[normalize_text(str(row["name"]))] = s
        if "title" in row and pd.notna(row["title"]):
            title_to_slug[normalize_text(str(row["title"]))] = s

    # 3. Process user favorites and resolve slugs
    interactions: List[Tuple[str, str, int]] = []
    unmapped_favorites: List[str] = []
    raw_favorite_count = 0

    for user in idiap_users:
        user_id = str(user.get("user_id", "")).strip()
        if not user_id:
            continue

        favs = user.get("favorites", [])
        for fav_title in favs:
            raw_favorite_count += 1
            if not isinstance(fav_title, str) or not fav_title.strip():
                continue

            fav_clean = fav_title.strip()
            norm_fav = normalize_text(fav_clean)

            # Deterministic Matching Cascades:
            # Rule 1: Direct Idiap raw title lookup
            slug = idiap_title_to_slug.get(fav_clean)
            # Rule 2: Normalized Idiap title lookup
            if not slug or slug not in catalog_slugs:
                slug = idiap_norm_title_to_slug.get(norm_fav)
            # Rule 3: Match against catalog 'Speaker: Title' (name column)
            if not slug or slug not in catalog_slugs:
                slug = name_to_slug.get(norm_fav)
            # Rule 4: Match against catalog 'title' column
            if not slug or slug not in catalog_slugs:
                slug = title_to_slug.get(norm_fav)
            # Rule 5: If title has speaker prefix "Speaker: Subtitle", try subtitle only
            if (not slug or slug not in catalog_slugs) and ":" in fav_clean:
                sub_title = normalize_text(fav_clean.split(":", 1)[1])
                slug = title_to_slug.get(sub_title)

            # Verification against catalog
            if slug and slug in catalog_slugs:
                interactions.append((user_id, slug, 1))
            else:
                unmapped_favorites.append(fav_clean)

    # 4. Deduplicate interactions on (user_id, slug)
    df_inter = pd.DataFrame(interactions, columns=["user_id", "slug", "signal"])
    before_dedup = len(df_inter)
    df_inter = df_inter.drop_duplicates(subset=["user_id", "slug"])
    after_dedup = len(df_inter)

    # 5. Update talks_df has_interactions flag
    active_slugs = set(df_inter["slug"])
    talks_df = talks_df.copy()
    talks_df["has_interactions"] = talks_df["slug"].isin(active_slugs)

    # 6. Aggregate Statistics
    fav_counts_per_user = df_inter.groupby("user_id")["slug"].count()
    users_ge_1 = len(fav_counts_per_user)
    users_ge_3 = int((fav_counts_per_user >= 3).sum())
    users_ge_5 = int((fav_counts_per_user >= 5).sum())
    users_ge_10 = int((fav_counts_per_user >= 10).sum())

    stats = {
        "raw_users_count": len(idiap_users),
        "raw_favorites_count": raw_favorite_count,
        "mapped_interactions_total": before_dedup,
        "mapped_interactions_deduped": after_dedup,
        "unmapped_favorites_count": len(unmapped_favorites),
        "unique_unmapped_titles": len(set(unmapped_favorites)),
        "active_users_ge_1": users_ge_1,
        "active_users_ge_3": users_ge_3,
        "active_users_ge_5": users_ge_5,
        "active_users_ge_10": users_ge_10,
        "catalog_talks_total": len(talks_df),
        "catalog_talks_with_interactions": int(talks_df["has_interactions"].sum()),
        "catalog_talks_cold_start": int((~talks_df["has_interactions"]).sum()),
    }

    return df_inter, talks_df, stats

