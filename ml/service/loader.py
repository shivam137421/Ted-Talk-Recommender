"""Model loader and recommendation manager singleton for TalkWise ML service."""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
import scipy.sparse as sp

from talkwise_ml.collaborative.models import PopularityModel
from talkwise_ml.content.model import ContentBasedRecommender
from talkwise_ml.hybrid.scorer import HybridRecommender

logger = logging.getLogger(__name__)

DEFAULT_MAPPING_PATH = Path("data/processed/slug_mapping.json")
DEFAULT_TALKS_PATH = Path("data/processed/talks_clean.csv")
DEFAULT_CF_PATH = Path("ml/artifacts/collaborative/collaborative_model.joblib")
DEFAULT_CONTENT_TFIDF_PATH = Path("ml/artifacts/content/tfidf_matrix.npz")
DEFAULT_CONTENT_VEC_PATH = Path("ml/artifacts/content/tfidf_vectorizer.joblib")
DEFAULT_CONTENT_NEIGHBORS_PATH = Path("ml/artifacts/content/content_neighbors.joblib")


class ModelManager:
    """Singleton managing recommendation models, vector matrices, and similarity indices."""

    _instance = None

    @classmethod
    def get_instance(cls, root_dir: Optional[Path] = None) -> "ModelManager":
        if cls._instance is None:
            cls._instance = cls(root_dir=root_dir)
        return cls._instance

    def __init__(self, root_dir: Optional[Path] = None):
        self.root = root_dir or Path.cwd()
        self.slug_to_idx: Dict[str, int] = {}
        self.idx_to_slug: Dict[int, str] = {}
        self.metadata_map: Dict[str, Dict[str, Any]] = {}
        self.content_neighbor_indices: Optional[np.ndarray] = None
        self.content_neighbor_scores: Optional[np.ndarray] = None

        self.content_model: Optional[ContentBasedRecommender] = None
        self.collab_model = None
        self.popularity_model: Optional[PopularityModel] = None
        self.hybrid_model: Optional[HybridRecommender] = None
        self.is_loaded: bool = False

        self._load()

    def _load(self):
        logger.info("Loading TalkWise ML artifacts and models...")

        mapping_path = self.root / DEFAULT_MAPPING_PATH
        with open(mapping_path, "r", encoding="utf-8") as f:
            mapping = json.load(f)
        self.slug_to_idx = mapping["slug_to_idx"]
        self.idx_to_slug = {int(k): v for k, v in mapping["idx_to_slug"].items()}

        talks_path = self.root / DEFAULT_TALKS_PATH
        df_talks = pd.read_csv(talks_path)
        for _, row in df_talks.iterrows():
            slug = str(row["slug"])
            tags_val = row["tags_json"]
            tags = json.loads(tags_val) if pd.notna(tags_val) else []
            self.metadata_map[slug] = {
                "title": str(row["title"]),
                "speaker": str(row["main_speaker"]),
                "speaker_occupation": str(row["speaker_occupation"]) if pd.notna(row["speaker_occupation"]) else "",
                "description": str(row["description"]),
                "tags": [t.lower() for t in tags],
                "views": int(row["views"]),
                "duration_seconds": int(row["duration_seconds"]),
                "has_transcript": bool(row["has_transcript"]),
                "has_interactions": bool(row["has_interactions"])
            }

        cf_path = self.root / DEFAULT_CF_PATH
        self.collab_model = joblib.load(cf_path)

        tfidf_path = self.root / DEFAULT_CONTENT_TFIDF_PATH
        tfidf_matrix = sp.load_npz(tfidf_path)

        vec_path = self.root / DEFAULT_CONTENT_VEC_PATH
        vectorizer = joblib.load(vec_path)

        nbrs_path = self.root / DEFAULT_CONTENT_NEIGHBORS_PATH
        nbrs_dict = joblib.load(nbrs_path)
        self.content_neighbor_indices = nbrs_dict["neighbor_indices"]
        self.content_neighbor_scores = nbrs_dict["neighbor_scores"]

        self.content_model = ContentBasedRecommender(
            tfidf_matrix=tfidf_matrix,
            slug_to_idx=self.slug_to_idx,
            idx_to_slug=self.idx_to_slug,
            vectorizer=vectorizer,
            precomputed_indices=self.content_neighbor_indices,
            precomputed_scores=self.content_neighbor_scores
        )

        self.popularity_model = PopularityModel()
        self.popularity_model.slug_to_idx = self.slug_to_idx
        self.popularity_model.idx_to_slug = self.idx_to_slug
        views_array = np.array([self.metadata_map.get(self.idx_to_slug[i], {}).get("views", 0) for i in range(len(self.slug_to_idx))], dtype=np.float64)
        self.popularity_model.item_counts = views_array
        self.popularity_model.ranked_indices = np.argsort(views_array)[::-1]

        self.hybrid_model = HybridRecommender(
            content_model=self.content_model,
            collaborative_model=self.collab_model,
            popularity_model=self.popularity_model,
            talk_metadata_map=self.metadata_map
        )

        self.is_loaded = True
        logger.info("Successfully loaded TalkWise ML service models (%d talks).", len(self.slug_to_idx))

    def recommend(
        self,
        favorite_slugs: Optional[List[str]] = None,
        preferred_tags: Optional[List[str]] = None,
        k: int = 10,
        exclude_slugs: Optional[List[str]] = None,
        include_favorites: bool = False
    ) -> List[Dict[str, Any]]:
        """Run hybrid recommendation pipeline."""
        if not self.is_loaded or self.hybrid_model is None:
            raise RuntimeError("Models are not loaded.")

        return self.hybrid_model.recommend(
            favorite_slugs=favorite_slugs,
            preferred_tags=preferred_tags,
            k=k,
            exclude_slugs=exclude_slugs,
            include_favorites=include_favorites
        )

    def get_similar(self, slug: str, k: int = 10) -> List[Dict[str, Any]]:
        """Return top-k similar talks using precomputed content cosine neighbors (< 1ms)."""
        if not self.is_loaded:
            raise RuntimeError("Models are not loaded.")

        if slug not in self.slug_to_idx:
            return []

        talk_idx = self.slug_to_idx[slug]
        nbr_indices = self.content_neighbor_indices[talk_idx][:k]
        nbr_scores = self.content_neighbor_scores[talk_idx][:k]

        results = []
        for idx, score in zip(nbr_indices, nbr_scores):
            nbr_slug = self.idx_to_slug[int(idx)]
            meta = self.metadata_map.get(nbr_slug, {})
            results.append({
                "slug": nbr_slug,
                "title": meta.get("title", nbr_slug),
                "speaker": meta.get("speaker", "TED Speaker"),
                "similarity_score": round(float(score), 4)
            })

        return results

    def get_popular(self, k: int = 10, exclude_slugs: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Return top-k popular talks by views snapshot."""
        if not self.is_loaded or self.popularity_model is None:
            raise RuntimeError("Models are not loaded.")

        pop_recs = self.popularity_model.recommend(favorite_slugs=[], k=k, exclude_slugs=exclude_slugs)
        results = []
        for slug, score in pop_recs:
            meta = self.metadata_map.get(slug, {})
            results.append({
                "slug": slug,
                "title": meta.get("title", slug),
                "speaker": meta.get("speaker", "TED Speaker"),
                "score": round(float(score), 4),
                "explanation": "Trending and highly viewed across TED"
            })
        return results

    def search(self, query: str, k: int = 20) -> List[Dict[str, Any]]:
        """Natural language search using multi-field TF-IDF cosine similarity."""
        if not self.is_loaded or self.content_model is None or not query.strip():
            return []

        q_clean = query.strip()
        vec = getattr(self.content_model, "vectorizer", None)
        matrix = getattr(self.content_model, "tfidf_matrix", None)

        if vec is None or matrix is None:
            return []

        try:
            q_vec = vec.transform([q_clean])
            if q_vec.nnz == 0:
                return []

            sims = (matrix @ q_vec.T).toarray().ravel()
            non_zero = np.where(sims > 0.005)[0]
            if len(non_zero) == 0:
                return []

            sorted_indices = non_zero[np.argsort(sims[non_zero])[::-1]]
            top_indices = sorted_indices[:k]

            results = []
            for idx in top_indices:
                slug = self.idx_to_slug[int(idx)]
                meta = self.metadata_map.get(slug, {})
                results.append({
                    "slug": slug,
                    "title": meta.get("title", slug),
                    "speaker": meta.get("speaker", "TED Speaker"),
                    "score": round(float(sims[idx]), 4),
                })
            return results
        except Exception as e:
            logger.warning("Error performing TF-IDF search for '%s': %s", query, e)
            return []
