"""Unit tests for ranking metrics, hybrid recommendation scoring, and cold-start logic."""

import json
import math
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
from scipy.sparse import load_npz

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from talkwise_ml.evaluation.metrics import (
    precision_at_k,
    recall_at_k,
    average_precision_at_k,
    ndcg_at_k,
    evaluate_cohort
)
from talkwise_ml.collaborative.models import PopularityModel, ItemItemCosineCF
from talkwise_ml.content.model import ContentBasedRecommender
from talkwise_ml.hybrid.scorer import HybridRecommender, min_max_normalize


class TestRankingMetrics(unittest.TestCase):
    """Test suite for ranking metrics using exact hand-computed examples."""

    def test_precision_at_k(self):
        actual = ["t1", "t2", "t3"]
        predicted = ["t1", "t4", "t2", "t5", "t6"]

        # At k=1: hit on t1 -> 1/1 = 1.0
        self.assertAlmostEqual(precision_at_k(actual, predicted, k=1), 1.0)
        # At k=2: hit on t1 -> 1/2 = 0.5
        self.assertAlmostEqual(precision_at_k(actual, predicted, k=2), 0.5)
        # At k=3: hits on t1, t2 -> 2/3 = 0.666666...
        self.assertAlmostEqual(precision_at_k(actual, predicted, k=3), 2.0 / 3.0)
        # At k=5: hits on t1, t2 -> 2/5 = 0.4
        self.assertAlmostEqual(precision_at_k(actual, predicted, k=5), 0.4)

    def test_recall_at_k(self):
        actual = ["t1", "t2", "t3", "t4"]
        predicted = ["t1", "t5", "t2", "t6", "t7"]

        # At k=1: 1/4 = 0.25
        self.assertAlmostEqual(recall_at_k(actual, predicted, k=1), 0.25)
        # At k=3: hits t1, t2 -> 2/4 = 0.5
        self.assertAlmostEqual(recall_at_k(actual, predicted, k=3), 0.5)
        # At k=5: hits t1, t2 -> 2/4 = 0.5
        self.assertAlmostEqual(recall_at_k(actual, predicted, k=5), 0.5)

    def test_average_precision_at_k(self):
        actual = ["t1", "t3"]
        # Hit at rank 1 (p@1=1.0) and rank 3 (p@3=2/3)
        predicted = ["t1", "t2", "t3", "t4"]
        # sum of precisions: 1.0 + 2/3 = 5/3; denominator = min(2, 4) = 2 -> (5/3)/2 = 5/6
        expected = (1.0 + (2.0 / 3.0)) / 2.0
        self.assertAlmostEqual(average_precision_at_k(actual, predicted, k=4), expected)

    def test_ndcg_at_k(self):
        actual = ["t1", "t2"]
        # Perfect prediction: ["t1", "t2", "t3"] -> NDCG = 1.0
        self.assertAlmostEqual(ndcg_at_k(actual, ["t1", "t2", "t3"], k=2), 1.0)
        # Reversed prediction: hit at rank 2 and 3
        # DCG@2: hit at 2 -> 1/log2(3)
        # IDCG@2: 1/log2(2) + 1/log2(3) = 1 + 1/log2(3)
        pred = ["t3", "t1", "t4"]
        dcg2 = 1.0 / math.log2(3.0)
        idcg2 = 1.0 / math.log2(2.0) + 1.0 / math.log2(3.0)
        self.assertAlmostEqual(ndcg_at_k(actual, pred, k=2), dcg2 / idcg2)

    def test_zero_or_empty_handling(self):
        self.assertEqual(precision_at_k([], ["t1"], k=5), 0.0)
        self.assertEqual(recall_at_k([], ["t1"], k=5), 0.0)
        self.assertEqual(average_precision_at_k([], ["t1"], k=5), 0.0)
        self.assertEqual(ndcg_at_k([], ["t1"], k=5), 0.0)


class TestHybridScorer(unittest.TestCase):
    """Test suite for HybridRecommender behavior and edge cases."""

    @classmethod
    def setUpClass(cls):
        # Load real trained artifacts
        matrix_path = Path("ml/artifacts/content/tfidf_matrix.npz")
        mapping_path = Path("data/processed/slug_mapping.json")
        cf_path = Path("ml/artifacts/collaborative/collaborative_model.joblib")
        talks_path = Path("data/processed/talks_clean.csv")
        inter_path = Path("data/processed/interactions.csv")
        vec_path = Path("ml/artifacts/content/tfidf_vectorizer.joblib")

        cls.tfidf_matrix = load_npz(matrix_path)
        with open(mapping_path, "r", encoding="utf-8") as f:
            mapping = json.load(f)
        cls.slug_to_idx = mapping["slug_to_idx"]
        cls.idx_to_slug = {int(k): v for k, v in mapping["idx_to_slug"].items()}
        cls.cf_model = joblib.load(cf_path)
        cls.talks_df = pd.read_csv(talks_path)
        cls.inter_df = pd.read_csv(inter_path)
        cls.vectorizer = joblib.load(vec_path)

        cls.content_model = ContentBasedRecommender(
            tfidf_matrix=cls.tfidf_matrix,
            slug_to_idx=cls.slug_to_idx,
            idx_to_slug=cls.idx_to_slug,
            vectorizer=cls.vectorizer,
            top_k_neighbors=50
        )

        # Build real popularity baseline
        cls.pop_model = PopularityModel()
        from talkwise_ml.collaborative.matrix import build_interaction_matrix
        inter_matrix, _, _, _, _ = build_interaction_matrix(cls.inter_df, cls.talks_df["slug"].tolist())
        cls.pop_model.fit(inter_matrix, cls.slug_to_idx, cls.idx_to_slug)

        cls.talk_metadata_map = {
            row["slug"]: {
                "title": row["title"],
                "tags": json.loads(row["tags_json"])
            }
            for _, row in cls.talks_df.iterrows()
        }

        cls.hybrid = HybridRecommender(
            content_model=cls.content_model,
            collaborative_model=cls.cf_model,
            popularity_model=cls.pop_model,
            talk_metadata_map=cls.talk_metadata_map
        )

    def test_user_cold_start_with_no_history_and_no_preferences(self):
        recs = self.hybrid.recommend(favorite_slugs=[], preferred_tags=None, k=5)
        self.assertEqual(len(recs), 5)
        self.assertEqual(recs[0]["source"], "popularity_fallback")
        self.assertTrue(len(recs[0]["explanation"]) > 0)

    def test_user_cold_start_with_topic_preferences(self):
        recs = self.hybrid.recommend(
            favorite_slugs=[],
            preferred_tags=["technology", "computers"],
            k=5
        )
        self.assertEqual(len(recs), 5)
        self.assertEqual(recs[0]["source"], "cold_start")
        self.assertIn("technology", recs[0]["explanation"].lower() + " " + str(recs[0]))

    def test_personalized_hybrid_recommendation(self):
        favs = ["ken_robinson_says_schools_kill_creativity"]
        recs = self.hybrid.recommend(favorite_slugs=favs, k=5)
        self.assertEqual(len(recs), 5)
        self.assertEqual(recs[0]["source"], "personalized")
        rec_slugs = [r["slug"] for r in recs]
        self.assertNotIn("ken_robinson_says_schools_kill_creativity", rec_slugs, "Favorites must be excluded")

    def test_unknown_slug_handling(self):
        recs = self.hybrid.recommend(favorite_slugs=["completely_invalid_slug_xyz"], k=5)
        self.assertTrue(len(recs) > 0, "Unknown slugs should fall back gracefully")

    def test_k_larger_than_catalog(self):
        recs = self.hybrid.recommend(favorite_slugs=["ken_robinson_says_schools_kill_creativity"], k=5000)
        self.assertLessEqual(len(recs), len(self.slug_to_idx))

    def test_deterministic_output(self):
        favs = ["ken_robinson_says_schools_kill_creativity", "jill_bolte_taylor_s_powerful_stroke_of_insight"]
        recs1 = self.hybrid.recommend(favorite_slugs=favs, k=5)
        recs2 = self.hybrid.recommend(favorite_slugs=favs, k=5)
        slugs1 = [r["slug"] for r in recs1]
        slugs2 = [r["slug"] for r in recs2]
        self.assertEqual(slugs1, slugs2, "Recommendations must be deterministic for identical inputs")


if __name__ == "__main__":
    unittest.main()
