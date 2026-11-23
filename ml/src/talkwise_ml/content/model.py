"""Content-based recommendation model and profile scoring."""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.preprocessing import normalize

logger = logging.getLogger(__name__)


class ContentBasedRecommender:
    """Inference engine for Content-Based Filtering using TF-IDF cosine similarity."""

    def __init__(
        self,
        tfidf_matrix: csr_matrix,
        slug_to_idx: Dict[str, int],
        idx_to_slug: Dict[int, str],
        vectorizer=None,
        talk_tags_map: Optional[Dict[str, List[str]]] = None,
        top_k_neighbors: int = 50,
        precomputed_indices: Optional[np.ndarray] = None,
        precomputed_scores: Optional[np.ndarray] = None
    ):
        self.tfidf_matrix = tfidf_matrix
        self.slug_to_idx = slug_to_idx
        self.idx_to_slug = idx_to_slug
        self.vectorizer = vectorizer
        self.talk_tags_map = talk_tags_map or {}
        self.top_k_neighbors = top_k_neighbors
        self.n_items = tfidf_matrix.shape[0]

        # Compact neighbor table for rapid single-talk item-item content queries
        if precomputed_indices is not None and precomputed_scores is not None:
            self.neighbor_indices = precomputed_indices
            self.neighbor_scores = precomputed_scores
        else:
            self.neighbor_indices = np.zeros((self.n_items, top_k_neighbors), dtype=np.int32)
            self.neighbor_scores = np.zeros((self.n_items, top_k_neighbors), dtype=np.float32)
            self._precompute_neighbors()

    def _precompute_neighbors(self):
        """Precompute top-N content neighbors for each talk using sparse matrix multiplication."""
        logger.info("Precomputing top-%d content neighbors for %d talks...", self.top_k_neighbors, self.n_items)
        # S = tfidf * tfidf.T
        sims = self.tfidf_matrix.dot(self.tfidf_matrix.T).tocsr()

        for i in range(self.n_items):
            row = sims.getrow(i)
            cols = row.indices
            vals = row.data

            mask = cols != i
            cols = cols[mask]
            vals = vals[mask]

            if len(vals) > 0:
                if len(vals) > self.top_k_neighbors:
                    top_part = np.argpartition(vals, -self.top_k_neighbors)[-self.top_k_neighbors:]
                    sorted_order = top_part[np.argsort(vals[top_part])[::-1]]
                    chosen_cols = cols[sorted_order]
                    chosen_vals = vals[sorted_order]
                else:
                    sorted_order = np.argsort(vals)[::-1]
                    chosen_cols = cols[sorted_order]
                    chosen_vals = vals[sorted_order]

                n_found = len(chosen_cols)
                self.neighbor_indices[i, :n_found] = chosen_cols
                self.neighbor_scores[i, :n_found] = chosen_vals

    def build_user_profile_vector(
        self,
        favorite_slugs: List[str],
        preferred_tags: Optional[List[str]] = None
    ) -> Optional[np.ndarray]:
        """Compute the user profile vector as the normalized centroid of favorited talks' vectors."""
        fav_indices = [self.slug_to_idx[s] for s in favorite_slugs if s in self.slug_to_idx]

        if fav_indices:
            # Centroid of favorited vectors
            submatrix = self.tfidf_matrix[fav_indices, :]
            profile = np.asarray(submatrix.mean(axis=0)).flatten()
            norm = np.linalg.norm(profile)
            if norm > 0:
                profile /= norm
            return profile

        # Fallback to preferred tags if user has no favorites
        if preferred_tags and self.vectorizer is not None:
            tag_text = " ".join(preferred_tags)
            vec = self.vectorizer.transform([tag_text])
            profile = np.asarray(vec.todense()).flatten()
            norm = np.linalg.norm(profile)
            if norm > 0:
                profile /= norm
            return profile

        return None

    def recommend(
        self,
        favorite_slugs: List[str],
        k: int = 10,
        preferred_tags: Optional[List[str]] = None,
        exclude_slugs: Optional[List[str]] = None
    ) -> List[Tuple[str, float]]:
        """Score all catalog talks by cosine similarity against user profile vector."""
        banned: Set[str] = set(favorite_slugs)
        if exclude_slugs:
            banned.update(exclude_slugs)

        profile_vec = self.build_user_profile_vector(favorite_slugs, preferred_tags)
        if profile_vec is None:
            return []

        # Cosine similarity is dot product of normalized vectors
        scores = self.tfidf_matrix.dot(profile_vec)

        for s in banned:
            if s in self.slug_to_idx:
                scores[self.slug_to_idx[s]] = -1.0

        top_indices = np.argsort(scores)[::-1][:k]
        results = []
        for idx in top_indices:
            if scores[idx] > 0.0:
                results.append((self.idx_to_slug[idx], float(scores[idx])))
        return results

    def recommend_similar_to_talk(
        self,
        slug: str,
        k: int = 10,
        exclude_slugs: Optional[List[str]] = None
    ) -> List[Tuple[str, float]]:
        """Retrieve precomputed top-N most similar talks to a target talk."""
        if slug not in self.slug_to_idx:
            return []

        banned: Set[str] = {slug}
        if exclude_slugs:
            banned.update(exclude_slugs)

        idx = self.slug_to_idx[slug]
        nbrs = self.neighbor_indices[idx]
        sims = self.neighbor_scores[idx]

        results = []
        for n_idx, score in zip(nbrs, sims):
            if score <= 0.0:
                break
            cand_slug = self.idx_to_slug[n_idx]
            if cand_slug not in banned:
                results.append((cand_slug, float(score)))
                if len(results) >= k:
                    break
        return results

