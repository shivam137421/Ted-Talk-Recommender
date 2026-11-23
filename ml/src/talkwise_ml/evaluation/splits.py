"""Reproducible train/validation/test splitting utilities for TalkWise."""

from typing import Tuple
import numpy as np
import pandas as pd


def per_user_holdout_split(
    interactions_df: pd.DataFrame,
    min_favorites: int = 5,
    test_ratio: float = 0.2,
    random_state: int = 42
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Perform a per-user holdout split for users with at least min_favorites.
    
    Each qualified user has test_ratio of their favorites held out as ground truth.
    Guarantees no interaction overlap between train and test.
    """
    rng = np.random.RandomState(random_state)

    # Filter qualified users
    user_counts = interactions_df.groupby("user_id")["slug"].count()
    qualified_users = set(user_counts[user_counts >= min_favorites].index)
    filtered_df = interactions_df[interactions_df["user_id"].isin(qualified_users)].copy()

    train_rows = []
    test_rows = []

    # Group by user and split deterministically
    for user_id, group in filtered_df.groupby("user_id"):
        items = group["slug"].tolist()
        n_items = len(items)

        # Shuffle indices deterministically for this user
        perm = rng.permutation(n_items)
        shuffled_items = [items[i] for i in perm]

        n_test = max(1, int(np.round(n_items * test_ratio)))
        # Guard: at least 1 item must remain in train
        if n_test >= n_items:
            n_test = n_items - 1

        user_test = shuffled_items[:n_test]
        user_train = shuffled_items[n_test:]

        for s in user_train:
            train_rows.append((user_id, s, 1))
        for s in user_test:
            test_rows.append((user_id, s, 1))

    train_df = pd.DataFrame(train_rows, columns=["user_id", "slug", "signal"])
    test_df = pd.DataFrame(test_rows, columns=["user_id", "slug", "signal"])

    return train_df, test_df


def per_user_train_val_test_split(
    interactions_df: pd.DataFrame,
    min_favorites: int = 5,
    val_ratio: float = 0.1,
    test_ratio: float = 0.2,
    random_state: int = 42
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split user interactions into train, validation, and test subsets.
    
    Used for hyperparameter tuning on validation without touching test data.
    """
    rng = np.random.RandomState(random_state)

    user_counts = interactions_df.groupby("user_id")["slug"].count()
    qualified_users = set(user_counts[user_counts >= min_favorites].index)
    filtered_df = interactions_df[interactions_df["user_id"].isin(qualified_users)].copy()

    train_rows = []
    val_rows = []
    test_rows = []

    for user_id, group in filtered_df.groupby("user_id"):
        items = group["slug"].tolist()
        n_items = len(items)

        perm = rng.permutation(n_items)
        shuffled_items = [items[i] for i in perm]

        n_test = max(1, int(np.round(n_items * test_ratio)))
        n_val = max(1, int(np.round(n_items * val_ratio)))

        # Guard: ensure at least 1 item remains in train
        if n_test + n_val >= n_items:
            n_val = 1
            n_test = 1
            if n_items < 3:
                n_val = 0

        user_test = shuffled_items[:n_test]
        user_val = shuffled_items[n_test:n_test + n_val]
        user_train = shuffled_items[n_test + n_val:]

        for s in user_train:
            train_rows.append((user_id, s, 1))
        for s in user_val:
            val_rows.append((user_id, s, 1))
        for s in user_test:
            test_rows.append((user_id, s, 1))

    train_df = pd.DataFrame(train_rows, columns=["user_id", "slug", "signal"])
    val_df = pd.DataFrame(val_rows, columns=["user_id", "slug", "signal"])
    test_df = pd.DataFrame(test_rows, columns=["user_id", "slug", "signal"])

    return train_df, val_df, test_df

