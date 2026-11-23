"""High-level serving interface for Collaborative Filtering recommendations."""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import joblib

logger = logging.getLogger(__name__)

DEFAULT_ARTIFACT_PATH = Path("ml/artifacts/collaborative/collaborative_model.joblib")


class CollaborativeRecommender:
    """Inference wrapper for trained collaborative filtering model with fold-in support."""

    def __init__(self, artifact_path: Optional[Path] = None):
        self.artifact_path = artifact_path or DEFAULT_ARTIFACT_PATH
        self.model = None
        self._load()

    def _load(self):
        if not self.artifact_path.exists():
            raise FileNotFoundError(f"Collaborative model artifact not found at {self.artifact_path}")
        logger.info("Loading collaborative model from %s...", self.artifact_path)
        self.model = joblib.load(self.artifact_path)

    def recommend(
        self,
        favorite_slugs: List[str],
        k: int = 10,
        exclude_slugs: Optional[List[str]] = None
    ) -> List[Dict]:
        """Generate top-k collaborative recommendations with confidence scores and explanation.
        
        Returns:
            List of dicts: [{'slug': str, 'score': float, 'source': 'collaborative'}]
        """
        if not self.model:
            self._load()

        raw_recs: List[Tuple[str, float]] = self.model.recommend(
            favorite_slugs=favorite_slugs,
            k=k,
            exclude_slugs=exclude_slugs
        )

        formatted = []
        for slug, score in raw_recs:
            formatted.append({
                "slug": slug,
                "score": round(float(score), 4),
                "source": "collaborative"
            })
        return formatted


# Module-level convenience function
_GLOBAL_RECOMMENDER: Optional[CollaborativeRecommender] = None


def recommend_collaborative(
    favorite_slugs: List[str],
    k: int = 10,
    exclude_slugs: Optional[List[str]] = None,
    artifact_path: Optional[Path] = None
) -> List[Dict]:
    """Top-level recommendation function using fold-in for arbitrary user history."""
    global _GLOBAL_RECOMMENDER
    if _GLOBAL_RECOMMENDER is None or artifact_path is not None:
        _GLOBAL_RECOMMENDER = CollaborativeRecommender(artifact_path=artifact_path)
    return _GLOBAL_RECOMMENDER.recommend(favorite_slugs=favorite_slugs, k=k, exclude_slugs=exclude_slugs)

