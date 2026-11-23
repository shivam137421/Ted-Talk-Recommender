"""Collaborative filtering model implementations in pure NumPy and SciPy."""

import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Set, Tuple

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.preprocessing import normalize

logger = logging.getLogger(__name__)


class BaseCollaborativeModel(ABC):
    """Abstract base class for collaborative filtering models."""

    @abstractmethod
    def fit(self, matrix: csr_matrix, slug_to_idx: Dict[str, int], idx_to_slug: Dict[int, str]):
        """Fit model on the user-item interaction matrix."""
        pass

    @abstractmethod
    def recommend(
        self,
        favorite_slugs: List[str],
        k: int = 10,
        exclude_slugs: Optional[List[str]] = None
    ) -> List[Tuple[str, float]]:
        """Generate top-k recommendations for an arbitrary user history using fold-in."""
        pass


class PopularityModel(BaseCollaborativeModel):
    """Non-personalized popularity baseline ranking talks by training interaction frequency."""

    def __init__(self):
        self.item_counts: np.ndarray = np.array([])
        self.slug_to_idx: Dict[str, int] = {}
        self.idx_to_slug: Dict[int, str] = {}
        self.ranked_indices: np.ndarray = np.array([])

    def fit(self, matrix: csr_matrix, slug_to_idx: Dict[str, int], idx_to_slug: Dict[int, str]):
        self.slug_to_idx = slug_to_idx
        self.idx_to_slug = idx_to_slug
        # Sum column interactions
        self.item_counts = np.asarray(matrix.sum(axis=0)).flatten()
        self.ranked_indices = np.argsort(self.item_counts)[::-1]

    def recommend(
        self,
        favorite_slugs: List[str],
        k: int = 10,
        exclude_slugs: Optional[List[str]] = None
    ) -> List[Tuple[str, float]]:
        banned: Set[str] = set(favorite_slugs)
        if exclude_slugs:
            banned.update(exclude_slugs)

        results = []
        for idx in self.ranked_indices:
            slug = self.idx_to_slug[idx]
            if slug not in banned:
                score = float(self.item_counts[idx])
                results.append((slug, score))
                if len(results) >= k:
                    break
        return results


class ItemItemCosineCF(BaseCollaborativeModel):
    """Item-Item Collaborative Filtering using truncated cosine similarity.
    
    Stores top-N neighbors per item for lightweight memory footprint (< 1 MB).
    Supports instant on-the-fly fold-in for any arbitrary user history.
    """

    def __init__(self, top_k_neighbors: int = 100):
        self.top_k_neighbors = top_k_neighbors
        self.slug_to_idx: Dict[str, int] = {}
        self.idx_to_slug: Dict[int, str] = {}
        # Compact neighbor storage: item_idx -> (neighbor_indices, neighbor_scores)
        self.neighbor_indices: np.ndarray = np.empty((0, 0), dtype=np.int32)
        self.neighbor_scores: np.ndarray = np.empty((0, 0), dtype=np.float32)
        self.n_items = 0

    def fit(self, matrix: csr_matrix, slug_to_idx: Dict[str, int], idx_to_slug: Dict[int, str]):
        self.slug_to_idx = slug_to_idx
        self.idx_to_slug = idx_to_slug
        self.n_items = len(slug_to_idx)

        logger.info("Fitting Item-Item Cosine CF on %d items...", self.n_items)
        # Normalize columns (items) with L2 norm
        col_normed = normalize(matrix.tocsc(), norm="l2", axis=0)
        
        # S = col_normed.T * col_normed (shape: n_items x n_items)
        sim_matrix = col_normed.T.dot(col_normed).tocsr()

        # Build compact truncated neighbor tables
        k_neighbors = min(self.top_k_neighbors, self.n_items - 1)
        self.neighbor_indices = np.zeros((self.n_items, k_neighbors), dtype=np.int32)
        self.neighbor_scores = np.zeros((self.n_items, k_neighbors), dtype=np.float32)

        for i in range(self.n_items):
            row = sim_matrix.getrow(i)
            cols = row.indices
            vals = row.data

            # Mask out self-similarity (similarity with itself)
            mask = cols != i
            cols = cols[mask]
            vals = vals[mask]

            if len(vals) > 0:
                if len(vals) > k_neighbors:
                    top_part = np.argpartition(vals, -k_neighbors)[-k_neighbors:]
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

        logger.info("Item-Item Cosine CF fitted. Neighbor tables size: %.2f MB",
                    (self.neighbor_indices.nbytes + self.neighbor_scores.nbytes) / (1024 * 1024))

    def recommend(
        self,
        favorite_slugs: List[str],
        k: int = 10,
        exclude_slugs: Optional[List[str]] = None
    ) -> List[Tuple[str, float]]:
        banned: Set[str] = set(favorite_slugs)
        if exclude_slugs:
            banned.update(exclude_slugs)

        # Map favorite slugs to item indices
        fav_indices = [self.slug_to_idx[s] for s in favorite_slugs if s in self.slug_to_idx]
        if not fav_indices:
            return []

        # Accumulate neighbor scores
        scores = np.zeros(self.n_items, dtype=np.float32)
        for idx in fav_indices:
            nbrs = self.neighbor_indices[idx]
            sims = self.neighbor_scores[idx]
            valid = sims > 0.0
            scores[nbrs[valid]] += sims[valid]

        # Mask out banned items
        for s in banned:
            if s in self.slug_to_idx:
                scores[self.slug_to_idx[s]] = -1.0

        top_indices = np.argsort(scores)[::-1][:k]
        results = []
        for idx in top_indices:
            if scores[idx] > 0.0:
                results.append((self.idx_to_slug[idx], float(scores[idx])))

        return results


class ImplicitALS(BaseCollaborativeModel):
    """Implicit Alternating Least Squares (Hu, Koren, Volinsky 2008) in pure NumPy.
    
    Uses closed-form user factor fold-in at inference time:
      x_u = (Y^T Y + Y^T (C_u - I) Y + lambda * I)^(-1) * Y^T C_u p_u
    """

    def __init__(
        self,
        n_factors: int = 32,
        regularization: float = 0.05,
        alpha: float = 20.0,
        n_iterations: int = 10,
        random_state: int = 42
    ):
        self.n_factors = n_factors
        self.regularization = regularization
        self.alpha = alpha
        self.n_iterations = n_iterations
        self.random_state = random_state

        self.slug_to_idx: Dict[str, int] = {}
        self.idx_to_slug: Dict[int, str] = {}
        self.item_factors: np.ndarray = np.empty((0, 0), dtype=np.float32)
        self.user_factors: np.ndarray = np.empty((0, 0), dtype=np.float32)
        self.YtY: np.ndarray = np.empty((0, 0), dtype=np.float32)
        self.n_items = 0

    def fit(self, matrix: csr_matrix, slug_to_idx: Dict[str, int], idx_to_slug: Dict[int, str]):
        self.slug_to_idx = slug_to_idx
        self.idx_to_slug = idx_to_slug
        n_users, self.n_items = matrix.shape

        rng = np.random.RandomState(self.random_state)
        # Initialize factors with small normal random values
        self.user_factors = rng.normal(0, 0.01, size=(n_users, self.n_factors)).astype(np.float32)
        self.item_factors = rng.normal(0, 0.01, size=(self.n_items, self.n_factors)).astype(np.float32)

        reg_eye = self.regularization * np.eye(self.n_factors, dtype=np.float32)
        csr_u = matrix.tocsr()
        csc_i = matrix.tocsc()

        logger.info("Training Implicit ALS (%d iterations, %d factors, alpha=%.1f, lambda=%.3f)...",
                    self.n_iterations, self.n_factors, self.alpha, self.regularization)

        for iteration in range(self.n_iterations):
            # Step 1: Update user factors
            Y = self.item_factors
            YtY = Y.T.dot(Y)

            for u in range(n_users):
                row = csr_u.getrow(u)
                items = row.indices
                if len(items) == 0:
                    continue
                # Confidence values: c_ui = 1 + alpha * r_ui
                # (c_ui - 1) = alpha * r_ui
                c_diff = self.alpha * row.data
                # Y_u = items factor submatrix
                Y_u = Y[items, :]
                # A = YtY + Y_u^T diag(c_diff) Y_u + lambda * I
                A = YtY + (Y_u.T * c_diff).dot(Y_u) + reg_eye
                # b = Y_u^T (1 + c_diff)
                b = (Y_u.T * (1.0 + c_diff)).sum(axis=1)
                self.user_factors[u] = np.linalg.solve(A, b)

            # Step 2: Update item factors
            X = self.user_factors
            XtX = X.T.dot(X)

            for i in range(self.n_items):
                col = csc_i.getcol(i)
                users = col.indices
                if len(users) == 0:
                    continue
                c_diff = self.alpha * col.data
                X_i = X[users, :]
                A = XtX + (X_i.T * c_diff).dot(X_i) + reg_eye
                b = (X_i.T * (1.0 + c_diff)).sum(axis=1)
                self.item_factors[i] = np.linalg.solve(A, b)

        # Precompute YtY for rapid fold-in at inference
        self.YtY = self.item_factors.T.dot(self.item_factors)
        logger.info("Implicit ALS training complete.")

    def fold_in_user(self, favorite_indices: List[int]) -> np.ndarray:
        """Solve user latent vector x_u in closed form for an arbitrary user history."""
        if not favorite_indices:
            return np.zeros(self.n_factors, dtype=np.float32)

        reg_eye = self.regularization * np.eye(self.n_factors, dtype=np.float32)
        Y_u = self.item_factors[favorite_indices, :]
        c_diff = self.alpha * np.ones(len(favorite_indices), dtype=np.float32)

        A = self.YtY + (Y_u.T * c_diff).dot(Y_u) + reg_eye
        b = (Y_u.T * (1.0 + c_diff)).sum(axis=1)
        return np.linalg.solve(A, b)

    def recommend(
        self,
        favorite_slugs: List[str],
        k: int = 10,
        exclude_slugs: Optional[List[str]] = None
    ) -> List[Tuple[str, float]]:
        banned: Set[str] = set(favorite_slugs)
        if exclude_slugs:
            banned.update(exclude_slugs)

        fav_indices = [self.slug_to_idx[s] for s in favorite_slugs if s in self.slug_to_idx]
        if not fav_indices:
            return []

        user_vec = self.fold_in_user(fav_indices)
        scores = self.item_factors.dot(user_vec)

        for s in banned:
            if s in self.slug_to_idx:
                scores[self.slug_to_idx[s]] = -1e9

        top_indices = np.argsort(scores)[::-1][:k]
        results = []
        for idx in top_indices:
            if scores[idx] > -1e8:
                results.append((self.idx_to_slug[idx], float(scores[idx])))
        return results

