"""Hybrid recommendation engine combining Content-Based and Collaborative Filtering."""

import logging
from typing import Dict, List, Optional, Set, Tuple
import numpy as np

logger = logging.getLogger(__name__)


def min_max_normalize(scores: np.ndarray) -> np.ndarray:
    """Normalize a 1D score array to [0, 1] range."""
    s_min = np.min(scores)
    s_max = np.max(scores)
    diff = s_max - s_min
    if diff <= 1e-9:
        return np.zeros_like(scores)
    return (scores - s_min) / diff


class HybridRecommender:
    """Adaptive Hybrid Recommendation Engine for TalkWise."""

    def __init__(
        self,
        content_model,
        collaborative_model,
        popularity_model,
        talk_metadata_map: Optional[Dict[str, Dict]] = None,
        cf_weight_rich: float = 0.65,
        cf_weight_moderate: float = 0.50,
        cf_weight_sparse: float = 0.25
    ):
        self.content_model = content_model
        self.collaborative_model = collaborative_model
        self.popularity_model = popularity_model
        self.talk_metadata_map = talk_metadata_map or {}

        # Blending parameters based on user history depth
        self.cf_weight_rich = cf_weight_rich          # >= 5 favorites
        self.cf_weight_moderate = cf_weight_moderate  # 3-4 favorites
        self.cf_weight_sparse = cf_weight_sparse      # 1-2 favorites

        self.slug_to_idx = content_model.slug_to_idx
        self.idx_to_slug = content_model.idx_to_slug
        self.n_items = len(self.slug_to_idx)

    def _determine_cf_weight(self, n_favorites: int) -> float:
        """Adaptively adjust collaborative weight based on the volume of user history."""
        if n_favorites == 0:
            return 0.0
        elif n_favorites <= 2:
            return self.cf_weight_sparse
        elif n_favorites <= 4:
            return self.cf_weight_moderate
        else:
            return self.cf_weight_rich

    def _generate_explanation(
        self,
        rec_slug: str,
        favorite_slugs: List[str],
        preferred_tags: Optional[List[str]],
        source: str
    ) -> str:
        """Generate an honest, signal-derived explanation for a recommendation."""
        rec_meta = self.talk_metadata_map.get(rec_slug, {})
        rec_tags = set(rec_meta.get("tags", []))
        rec_title = rec_meta.get("title", rec_slug)

        if source == "cold_start" and preferred_tags:
            shared = rec_tags.intersection(set(preferred_tags))
            if shared:
                return f"Matches your chosen topics: {', '.join(sorted(shared)[:3])}"
            return "Recommended based on your topic preferences"

        if source == "popularity_fallback":
            return "Trending and highly viewed across TED"

        # For personalized recommendations, find top contributing favorite
        if favorite_slugs:
            best_fav_title = None
            max_shared_tags = []

            for fav_slug in favorite_slugs:
                fav_meta = self.talk_metadata_map.get(fav_slug, {})
                fav_tags = set(fav_meta.get("tags", []))
                common = fav_tags.intersection(rec_tags)
                if len(common) > len(max_shared_tags):
                    max_shared_tags = list(common)
                    best_fav_title = fav_meta.get("title", fav_slug)

            if best_fav_title and max_shared_tags:
                return f"Similar to '{best_fav_title}' (topics: {', '.join(sorted(max_shared_tags)[:2])})"
            elif best_fav_title:
                return f"Recommended because you favorited '{best_fav_title}'"

        return "Personalized recommendation based on your watch history"

    def recommend(
        self,
        favorite_slugs: Optional[List[str]] = None,
        preferred_tags: Optional[List[str]] = None,
        k: int = 10,
        exclude_slugs: Optional[List[str]] = None,
        include_favorites: bool = False
    ) -> List[Dict]:
        """Generate hybrid recommendations with adaptive blending, cold-start fallback, and explanations."""
        favs = favorite_slugs or []
        banned: Set[str] = set() if include_favorites else set(favs)
        if exclude_slugs:
            banned.update(exclude_slugs)

        # Filter valid favorites known to catalog
        valid_favs = [s for s in favs if s in self.slug_to_idx]
        n_favs = len(valid_favs)
        cf_weight = self._determine_cf_weight(n_favs)
        content_weight = 1.0 - cf_weight

        # Branch 1: User Cold-Start (0 valid favorites)
        if n_favs == 0:
            if preferred_tags:
                # Use preferred tags to generate content scores
                content_recs = self.content_model.recommend(
                    favorite_slugs=[],
                    k=k,
                    preferred_tags=preferred_tags,
                    exclude_slugs=list(banned)
                )
                results = []
                for slug, score in content_recs:
                    results.append({
                        "slug": slug,
                        "score": round(float(score), 4),
                        "source": "cold_start",
                        "explanation": self._generate_explanation(slug, favs, preferred_tags, "cold_start")
                    })
                if results:
                    return results

            # Fallback to popularity
            pop_recs = self.popularity_model.recommend(
                favorite_slugs=[],
                k=k,
                exclude_slugs=list(banned)
            )
            results = []
            for slug, score in pop_recs:
                results.append({
                    "slug": slug,
                    "score": round(float(score), 4),
                    "source": "popularity_fallback",
                    "explanation": self._generate_explanation(slug, favs, preferred_tags, "popularity_fallback")
                })
            return results

        # Branch 2: Personalized Hybrid Scoring
        # Step A: Compute raw Content Scores
        profile_vec = self.content_model.build_user_profile_vector(valid_favs, preferred_tags)
        if profile_vec is not None:
            raw_content_scores = self.content_model.tfidf_matrix.dot(profile_vec)
        else:
            raw_content_scores = np.zeros(self.n_items, dtype=np.float32)

        # Step B: Compute raw Collaborative Scores
        raw_cf_scores = np.zeros(self.n_items, dtype=np.float32)
        if cf_weight > 0.0:
            fav_indices = [self.slug_to_idx[s] for s in valid_favs]
            for idx in fav_indices:
                nbrs = self.collaborative_model.neighbor_indices[idx]
                sims = self.collaborative_model.neighbor_scores[idx]
                valid = sims > 0.0
                raw_cf_scores[nbrs[valid]] += sims[valid]

        # Step C: Normalize per-user scores
        norm_content = min_max_normalize(raw_content_scores)
        norm_cf = min_max_normalize(raw_cf_scores)

        # Step D: Adaptive Blend
        hybrid_scores = (cf_weight * norm_cf) + (content_weight * norm_content)

        # Step E: Mask banned items
        for s in banned:
            if s in self.slug_to_idx:
                hybrid_scores[self.slug_to_idx[s]] = -1.0

        top_indices = np.argsort(hybrid_scores)[::-1][:k]
        results = []
        for idx in top_indices:
            score = hybrid_scores[idx]
            if score > 0.0:
                slug = self.idx_to_slug[idx]
                results.append({
                    "slug": slug,
                    "score": round(float(score), 4),
                    "source": "personalized",
                    "explanation": self._generate_explanation(slug, valid_favs, preferred_tags, "personalized")
                })

        return results
