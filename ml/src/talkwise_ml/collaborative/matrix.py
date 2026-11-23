"""User-Item sparse matrix construction and slug indexing utilities."""

from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix


def build_interaction_matrix(
    interactions_df: pd.DataFrame,
    catalog_slugs: Optional[List[str]] = None
) -> Tuple[csr_matrix, Dict[str, int], Dict[int, str], Dict[str, int], Dict[int, str]]:
    """Build a CSR sparse user-item matrix from interactions DataFrame.
    
    Args:
        interactions_df: DataFrame with ['user_id', 'slug', 'signal']
        catalog_slugs: Optional full catalog slug list (2,550 talks). If provided, item
                       dimensions match the full catalog. Otherwise, matches active slugs.
                       
    Returns:
        matrix: csr_matrix of shape (n_users, n_items)
        user_to_idx: map from user_id to row index
        idx_to_user: map from row index to user_id
        slug_to_idx: map from talk slug to column index
        idx_to_slug: map from column index to talk slug
    """
    unique_users = sorted(interactions_df["user_id"].unique())
    user_to_idx = {u: i for i, u in enumerate(unique_users)}
    idx_to_user = {i: u for i, u in enumerate(unique_users)}

    if catalog_slugs is not None:
        item_slugs = sorted(list(catalog_slugs))
    else:
        item_slugs = sorted(interactions_df["slug"].unique())

    slug_to_idx = {s: i for i, s in enumerate(item_slugs)}
    idx_to_slug = {i: s for i, s in enumerate(item_slugs)}

    # Filter interactions that belong to slug_to_idx and user_to_idx
    valid_mask = interactions_df["slug"].isin(slug_to_idx) & interactions_df["user_id"].isin(user_to_idx)
    valid_df = interactions_df[valid_mask]

    row_indices = valid_df["user_id"].map(user_to_idx).values
    col_indices = valid_df["slug"].map(slug_to_idx).values
    data = valid_df["signal"].values.astype(np.float32)

    matrix = csr_matrix(
        (data, (row_indices, col_indices)),
        shape=(len(unique_users), len(item_slugs)),
        dtype=np.float32
    )

    return matrix, user_to_idx, idx_to_user, slug_to_idx, idx_to_slug

