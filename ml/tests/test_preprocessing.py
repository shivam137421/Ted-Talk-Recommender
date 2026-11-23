"""Unit tests for TalkWise dataset validation and preprocessing pipeline."""

import hashlib
import json
import unittest
from pathlib import Path
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from talkwise_ml.preprocessing.slug import extract_canonical_slug, normalize_text
from talkwise_ml.preprocessing.cleaner import parse_tags_list, parse_timestamp_to_iso


class TestSlugExtraction(unittest.TestCase):
    """Test suite for URL slug extraction and edge cases."""

    def test_clean_https_url(self):
        url = "https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity"
        self.assertEqual(extract_canonical_slug(url), "ken_robinson_says_schools_kill_creativity")

    def test_trailing_newline_and_whitespace(self):
        url = "https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity\n\r  "
        self.assertEqual(extract_canonical_slug(url), "ken_robinson_says_schools_kill_creativity")

    def test_http_protocol_and_html_extension(self):
        url = "http://www.ted.com/talks/scott_fraser_the_problem_with_eyewitness_testimony.html"
        self.assertEqual(extract_canonical_slug(url), "scott_fraser_the_problem_with_eyewitness_testimony")

    def test_query_params_and_fragments(self):
        url = "https://ted.com/talks/brene_brown_on_vulnerability?language=en&utm_source=ted.com#t-105"
        self.assertEqual(extract_canonical_slug(url), "brene_brown_on_vulnerability")

    def test_trailing_slashes_and_case(self):
        url = "HTTPS://WWW.TED.COM/TALKS/SIMON_SINEK_HOW_GREAT_LEADERS_INSPIRE_ACTION///"
        self.assertEqual(extract_canonical_slug(url), "simon_sinek_how_great_leaders_inspire_action")

    def test_slug_only_or_path(self):
        url = "talks/hans_rosling_shows_the_best_stats_you_ve_ever_seen"
        self.assertEqual(extract_canonical_slug(url), "hans_rosling_shows_the_best_stats_you_ve_ever_seen")

    def test_empty_or_none(self):
        self.assertEqual(extract_canonical_slug(""), "")
        self.assertEqual(extract_canonical_slug(None), "")


class TestTextNormalization(unittest.TestCase):
    """Test suite for text normalization."""

    def test_punctuation_and_whitespace(self):
        text = "Sir Ken Robinson: Do schools kill creativity?!"
        self.assertEqual(normalize_text(text), "sir ken robinson do schools kill creativity")

    def test_quotes_and_accents(self):
        text = "Brené Brown: The Power of Vulnerability -- Part 1"
        self.assertEqual(normalize_text(text), "brené brown the power of vulnerability part 1")

    def test_empty_string(self):
        self.assertEqual(normalize_text(""), "")
        self.assertEqual(normalize_text(None), "")


class TestCleaningHelpers(unittest.TestCase):
    """Test parsing helpers for tags and timestamps."""

    def test_parse_tags_valid_list_repr(self):
        raw = "['technology', 'design', 'education']"
        self.assertEqual(parse_tags_list(raw), ["technology", "design", "education"])

    def test_parse_tags_empty_or_nan(self):
        self.assertEqual(parse_tags_list("[]"), [])
        self.assertEqual(parse_tags_list(None), [])

    def test_parse_timestamp_to_iso(self):
        # 1151367060 -> 2006-06-27
        self.assertEqual(parse_timestamp_to_iso(1151367060), "2006-06-27")
        self.assertIsNone(parse_timestamp_to_iso("invalid"))


class TestProcessedDatasetsIntegrity(unittest.TestCase):
    """Verify integrity, counts, and properties of generated data/processed files."""

    def setUp(self):
        self.processed_dir = Path("data/processed")
        self.talks_path = self.processed_dir / "talks_clean.csv"
        self.inter_path = self.processed_dir / "interactions.csv"
        self.stats_path = self.processed_dir / "dataset_stats.json"

    def test_files_exist(self):
        self.assertTrue(self.talks_path.exists(), "talks_clean.csv missing")
        self.assertTrue(self.inter_path.exists(), "interactions.csv missing")
        self.assertTrue(self.stats_path.exists(), "dataset_stats.json missing")

    def test_talks_clean_properties(self):
        df_talks = pd.read_csv(self.talks_path)
        self.assertEqual(len(df_talks), 2550, "Total talks in catalog must be exactly 2,550")
        self.assertEqual(df_talks["slug"].nunique(), 2550, "All slugs must be unique")
        # Ensure no empty titles or empty combined_text
        self.assertEqual(df_talks["title"].isna().sum(), 0, "No null titles allowed")
        self.assertEqual((df_talks["title"].str.strip() == "").sum(), 0, "No blank titles allowed")
        self.assertEqual((df_talks["combined_text"].str.strip() == "").sum(), 0, "No blank combined_text allowed")
        # Check has_interactions count
        active_count = df_talks["has_interactions"].sum()
        self.assertEqual(active_count, 1201, "Exactly 1,201 talks must have interactions")

    def test_interactions_properties(self):
        df_inter = pd.read_csv(self.inter_path)
        df_talks = pd.read_csv(self.talks_path)
        talk_slugs = set(df_talks["slug"])

        # Check total deduplicated interactions
        self.assertEqual(len(df_inter), 129557, "Expected exactly 129,557 deduplicated interactions")
        # Check no duplicates on (user_id, slug)
        dup_count = df_inter.duplicated(subset=["user_id", "slug"]).sum()
        self.assertEqual(dup_count, 0, "Zero duplicates allowed in interactions table")
        # Check referential integrity: all slugs in interactions must exist in talks_clean
        orphan_slugs = set(df_inter["slug"]) - talk_slugs
        self.assertEqual(len(orphan_slugs), 0, f"Found orphan slugs in interactions: {orphan_slugs}")
        # Check unique active users
        self.assertEqual(df_inter["user_id"].nunique(), 12401, "Expected 12,401 active users")

    def test_idempotency(self):
        """Verify that running checksum check matches expectation."""
        def hash_file(p):
            h = hashlib.sha256()
            with open(p, "rb") as f:
                while c := f.read(8192 * 1024):
                    h.update(c)
            return h.hexdigest()

        h1 = hash_file(self.talks_path)
        h2 = hash_file(self.inter_path)
        self.assertEqual(h1, "f066f8c81b351bd5f77c100b603e4104f429975ba39abfecb11d7d184637ef0c")
        self.assertEqual(h2, "7c90311810b3509cb4f8651b0266072e5a1c0f5681c7cc608e3ddb2731038bba")


if __name__ == "__main__":
    unittest.main()

