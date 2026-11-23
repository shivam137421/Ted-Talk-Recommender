"""Unit tests for TalkWise ML microservice logic, schemas, and model manager."""

import json
import os
import sys
import unittest
from pathlib import Path

# Add paths
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "ml" / "src") not in sys.path:
    sys.path.insert(0, str(ROOT / "ml" / "src"))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.service.loader import ModelManager
from ml.service.schemas import (
    RecommendationRequest,
    RecommendationItem,
    SimilarTalkItem
)
from ml.service.main import verify_internal_key, ML_INTERNAL_KEY


class MockRequestWithHeaders:
    """Mock request object for testing header verification without asyncio sockets."""

    def __init__(self, headers: dict):
        self.headers = headers


class TestMLServiceSchemas(unittest.TestCase):
    """Test suite for ML service request/response schemas."""

    def test_recommendation_request_valid(self):
        """Test parsing valid recommendation request dict."""
        payload = {
            "favorite_slugs": ["ken_robinson_says_schools_kill_creativity"],
            "preferred_tags": ["Education", "Creativity"],
            "k": 5,
            "exclude_slugs": ["some_talk"],
            "include_favorites": True
        }
        req = RecommendationRequest.from_dict(payload)
        self.assertEqual(req.favorite_slugs, ["ken_robinson_says_schools_kill_creativity"])
        self.assertEqual(req.preferred_tags, ["education", "creativity"])
        self.assertEqual(req.k, 5)
        self.assertEqual(req.exclude_slugs, ["some_talk"])
        self.assertTrue(req.include_favorites)

    def test_recommendation_request_defaults_and_clamping(self):
        """Test defaults and k clamping to [1, 100]."""
        # Test default k and empty lists
        req = RecommendationRequest.from_dict({})
        self.assertEqual(req.favorite_slugs, [])
        self.assertEqual(req.preferred_tags, [])
        self.assertEqual(req.k, 10)
        self.assertFalse(req.include_favorites)

        # Test k clamped to max 100
        req_max = RecommendationRequest.from_dict({"k": 500})
        self.assertEqual(req_max.k, 100)

        # Test k clamped to min 1
        req_min = RecommendationRequest.from_dict({"k": -5})
        self.assertEqual(req_min.k, 1)

    def test_recommendation_request_invalid_type(self):
        """Test passing non-dict payload raises ValueError."""
        with self.assertRaises(ValueError):
            RecommendationRequest.from_dict("invalid")

    def test_recommendation_item_serialization(self):
        """Test RecommendationItem serialization."""
        item = RecommendationItem(
            slug="test_slug",
            score=0.854321,
            source="personalized",
            explanation="Similar to your favorites"
        )
        d = item.to_dict()
        self.assertEqual(d["slug"], "test_slug")
        self.assertEqual(d["score"], 0.8543)
        self.assertEqual(d["source"], "personalized")

    def test_similar_talk_item_serialization(self):
        """Test SimilarTalkItem serialization."""
        item = SimilarTalkItem(
            slug="test_slug",
            title="A Great Talk",
            speaker="Jane Doe",
            similarity_score=0.765432
        )
        d = item.to_dict()
        self.assertEqual(d["similarity_score"], 0.7654)


class TestMLServiceSecurity(unittest.TestCase):
    """Test suite for internal authentication key validation."""

    def test_verify_internal_key_success(self):
        """Test valid X-Internal-Key matches configured secret."""
        req_lower = MockRequestWithHeaders({"x-internal-key": ML_INTERNAL_KEY})
        self.assertTrue(verify_internal_key(req_lower))

        req_upper = MockRequestWithHeaders({"X-Internal-Key": ML_INTERNAL_KEY})
        self.assertTrue(verify_internal_key(req_upper))

    def test_verify_internal_key_unauthorized(self):
        """Test missing or incorrect key fails."""
        req_missing = MockRequestWithHeaders({})
        self.assertFalse(verify_internal_key(req_missing))

        req_wrong = MockRequestWithHeaders({"x-internal-key": "wrong_key_12345"})
        self.assertFalse(verify_internal_key(req_wrong))


class TestModelManager(unittest.TestCase):
    """Test suite for ModelManager singleton and recommendation methods."""

    @classmethod
    def setUpClass(cls):
        cls.manager = ModelManager.get_instance(root_dir=ROOT)

    def test_manager_singleton_loaded(self):
        """Test ModelManager is loaded with all 2,550 talks."""
        self.assertTrue(self.manager.is_loaded)
        self.assertEqual(len(self.manager.slug_to_idx), 2550)
        self.assertEqual(len(self.manager.idx_to_slug), 2550)
        self.assertEqual(len(self.manager.metadata_map), 2550)

    def test_personalized_recommendation(self):
        """Test recommendation with known favorite talk."""
        recs = self.manager.recommend(
            favorite_slugs=["ken_robinson_says_schools_kill_creativity"],
            k=5
        )
        self.assertGreaterEqual(len(recs), 1)
        self.assertLessEqual(len(recs), 5)
        for item in recs:
            self.assertIn("slug", item)
            self.assertIn("score", item)
            self.assertIn("source", item)
            self.assertIn("explanation", item)
            self.assertEqual(item["source"], "personalized")
            # Favorited talk should be excluded by default
            self.assertNotEqual(item["slug"], "ken_robinson_says_schools_kill_creativity")

    def test_cold_start_preferred_tags(self):
        """Test cold-start recommendation with preferred tags."""
        recs = self.manager.recommend(
            favorite_slugs=[],
            preferred_tags=["technology", "design"],
            k=5
        )
        self.assertEqual(len(recs), 5)
        for item in recs:
            self.assertEqual(item["source"], "cold_start")
            self.assertTrue(
                "Matches your chosen topics" in item["explanation"] or
                "topic preferences" in item["explanation"]
            )

    def test_cold_start_popularity_fallback(self):
        """Test cold-start recommendation with zero favorites and zero tags."""
        recs = self.manager.recommend(
            favorite_slugs=[],
            preferred_tags=[],
            k=5
        )
        self.assertEqual(len(recs), 5)
        for item in recs:
            self.assertEqual(item["source"], "popularity_fallback")
            self.assertEqual(item["explanation"], "Trending and highly viewed across TED")

    def test_similar_talks(self):
        """Test retrieving similar talks for a known slug."""
        sims = self.manager.get_similar("ken_robinson_says_schools_kill_creativity", k=3)
        self.assertEqual(len(sims), 3)
        for s in sims:
            self.assertIn("slug", s)
            self.assertIn("title", s)
            self.assertIn("speaker", s)
            self.assertIn("similarity_score", s)
            self.assertGreater(s["similarity_score"], 0.0)

    def test_similar_talks_unknown_slug(self):
        """Test retrieving similar talks for unknown slug returns empty list."""
        sims = self.manager.get_similar("non_existent_talk_slug", k=3)
        self.assertEqual(sims, [])

    def test_popular_talks(self):
        """Test popular talks endpoint returns highest-viewed talks in descending order."""
        pops = self.manager.get_popular(k=5)
        self.assertEqual(len(pops), 5)
        # Ken Robinson has the highest views in the dataset (~47M)
        self.assertEqual(pops[0]["slug"], "ken_robinson_says_schools_kill_creativity")
        # Check descending scores
        scores = [p["score"] for p in pops]
        self.assertEqual(scores, sorted(scores, reverse=True))


if __name__ == "__main__":
    unittest.main()
