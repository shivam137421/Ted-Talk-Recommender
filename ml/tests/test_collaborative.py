"""Unit tests for Collaborative Filtering matrix, models, and inference fold-in."""

import unittest
from pathlib import Path
import numpy as np
import pandas as pd
import joblib

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from talkwise_ml.evaluation.splits import per_user_holdout_split, per_user_train_val_test_split
from talkwise_ml.collaborative.matrix import build_interaction_matrix
from talkwise_ml.collaborative.models import ItemItemCosineCF, ImplicitALS, PopularityModel
from talkwise_ml.collaborative.recommender import recommend_collaborative, CollaborativeRecommender


class TestSplitLeakage(unittest.TestCase):
    """Test suite ensuring zero data leakage in user-based evaluation splits."""

    def setUp(self):
        # Create synthetic interactions for 5 users with 10 items each
        rows = []
        for u in range(5):
            for i in range(10):
                rows.append((f"user_{u}", f"talk_{i}", 1))
        self.df = pd.DataFrame(rows, columns=["user_id", "slug", "signal"])

    def test_no_leakage_between_train_and_test(self):
        train_df, test_df = per_user_holdout_split(self.df, min_favorites=5, test_ratio=0.2, random_state=42)

        for u in train_df["user_id"].unique():
            train_items = set(train_df[train_df["user_id"] == u]["slug"])
            test_items = set(test_df[test_df["user_id"] == u]["slug"])
            overlap = train_items.intersection(test_items)
            self.assertEqual(len(overlap), 0, f"Found train/test leakage for user {u}: {overlap}")

    def test_no_leakage_in_three_way_split(self):
        train_df, val_df, test_df = per_user_train_val_test_split(
            self.df, min_favorites=5, val_ratio=0.1, test_ratio=0.2, random_state=42
        )
        for u in train_df["user_id"].unique():
            tr = set(train_df[train_df["user_id"] == u]["slug"])
            va = set(val_df[val_df["user_id"] == u]["slug"])
            te = set(test_df[test_df["user_id"] == u]["slug"])

            self.assertEqual(len(tr.intersection(va)), 0)
            self.assertEqual(len(tr.intersection(te)), 0)
            self.assertEqual(len(va.intersection(te)), 0)


class TestCollaborativeModels(unittest.TestCase):
    """Test suite for collaborative filtering algorithms and fold-in behavior."""

    @classmethod
    def setUpClass(cls):
        cls.interactions_path = Path("data/processed/interactions.csv")
        cls.talks_path = Path("data/processed/talks_clean.csv")
        cls.df_inter = pd.read_csv(cls.interactions_path)
        cls.df_talks = pd.read_csv(cls.talks_path)
        cls.catalog_slugs = cls.df_talks["slug"].tolist()

        # Build small matrix on first 500 users for quick test validation
        sample_users = cls.df_inter["user_id"].unique()[:500]
        sample_inter = cls.df_inter[cls.df_inter["user_id"].isin(sample_users)]
        cls.matrix, cls.u2i, cls.i2u, cls.s2i, cls.i2s = build_interaction_matrix(
            sample_inter, catalog_slugs=cls.catalog_slugs
        )

    def test_matrix_shape_and_sparsity(self):
        n_users, n_items = self.matrix.shape
        self.assertEqual(n_users, 500)
        self.assertEqual(n_items, 2550)
        sparsity = 1.0 - (self.matrix.nnz / (n_users * n_items))
        self.assertGreater(sparsity, 0.95, "Matrix must be sparse")

    def test_item_item_cosine_cf(self):
        model = ItemItemCosineCF(top_k_neighbors=20)
        model.fit(self.matrix, self.s2i, self.i2s)

        favs = ["ken_robinson_says_schools_kill_creativity"]
        recs = model.recommend(favs, k=5)
        self.assertTrue(len(recs) > 0, "Model should return recommendations")
        rec_slugs = [slug for slug, _ in recs]
        self.assertNotIn("ken_robinson_says_schools_kill_creativity", rec_slugs, "Favorites must be excluded")

    def test_exclude_slugs_enforced(self):
        model = ItemItemCosineCF(top_k_neighbors=20)
        model.fit(self.matrix, self.s2i, self.i2s)

        favs = ["ken_robinson_says_schools_kill_creativity"]
        recs_initial = model.recommend(favs, k=5)
        self.assertTrue(len(recs_initial) > 0)
        first_rec = recs_initial[0][0]

        # Exclude the first recommendation explicitly
        recs_filtered = model.recommend(favs, k=5, exclude_slugs=[first_rec])
        filtered_slugs = [slug for slug, _ in recs_filtered]
        self.assertNotIn(first_rec, filtered_slugs, "Explicitly excluded item must never be returned")

    def test_unknown_slugs_handled_gracefully(self):
        model = ItemItemCosineCF(top_k_neighbors=20)
        model.fit(self.matrix, self.s2i, self.i2s)

        # Non-existent slug should not throw an error
        recs = model.recommend(["non_existent_fake_slug_12345"], k=5)
        self.assertEqual(recs, [], "Unknown slug should produce empty recommendations without error")

    def test_artifact_loads_in_fresh_process(self):
        artifact_path = Path("ml/artifacts/collaborative/collaborative_model.joblib")
        self.assertTrue(artifact_path.exists(), "Trained collaborative model artifact must exist")
        model = joblib.load(artifact_path)
        self.assertIsNotNone(model)

        # Test inference via recommender module
        recs = recommend_collaborative(["ken_robinson_says_schools_kill_creativity"], k=5)
        self.assertEqual(len(recs), 5)
        self.assertEqual(recs[0]["source"], "collaborative")
        self.assertIn("slug", recs[0])
        self.assertIn("score", recs[0])


if __name__ == "__main__":
    unittest.main()

