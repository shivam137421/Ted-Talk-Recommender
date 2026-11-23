"""Ranking evaluation metrics for TalkWise recommendation systems."""

import math
from typing import Dict, List, Set, Sequence
import numpy as np


def precision_at_k(actual: Sequence[str], predicted: Sequence[str], k: int) -> float:
    """Compute Precision@K.
    
    Fraction of top-K recommended items that are relevant (in ground truth).
    """
    if k <= 0:
        return 0.0
    pred_k = predicted[:k]
    if not pred_k:
        return 0.0
    act_set = set(actual)
    hits = sum(1 for item in pred_k if item in act_set)
    return hits / float(k)


def recall_at_k(actual: Sequence[str], predicted: Sequence[str], k: int) -> float:
    """Compute Recall@K.
    
    Fraction of relevant ground-truth items that appear in the top-K recommendations.
    """
    if not actual or k <= 0:
        return 0.0
    pred_k = predicted[:k]
    act_set = set(actual)
    hits = sum(1 for item in pred_k if item in act_set)
    return hits / float(len(act_set))


def average_precision_at_k(actual: Sequence[str], predicted: Sequence[str], k: int) -> float:
    """Compute Average Precision at cutoff K (AP@K)."""
    if not actual or k <= 0:
        return 0.0
    pred_k = predicted[:k]
    act_set = set(actual)

    score = 0.0
    num_hits = 0.0

    for i, p in enumerate(pred_k):
        if p in act_set:
            num_hits += 1.0
            score += num_hits / (i + 1.0)

    denominator = min(len(act_set), k)
    if denominator == 0:
        return 0.0
    return score / float(denominator)


def ndcg_at_k(actual: Sequence[str], predicted: Sequence[str], k: int) -> float:
    """Compute Normalized Discounted Cumulative Gain at cutoff K (NDCG@K)."""
    if not actual or k <= 0:
        return 0.0
    pred_k = predicted[:k]
    act_set = set(actual)

    dcg = 0.0
    for i, p in enumerate(pred_k):
        if p in act_set:
            dcg += 1.0 / math.log2(i + 2.0)

    # Ideal DCG: perfect ranking where all top slots are occupied by relevant items
    idcg_len = min(len(act_set), k)
    idcg = sum(1.0 / math.log2(i + 2.0) for i in range(idcg_len))

    if idcg <= 0.0:
        return 0.0
    return dcg / idcg


def evaluate_cohort(
    ground_truth: Dict[str, List[str]],
    predictions: Dict[str, List[str]],
    k_values: Sequence[int] = (5, 10, 20)
) -> Dict[str, float]:
    """Compute mean metrics across all evaluated users for multiple cutoff values."""
    results = {}
    users = [u for u in ground_truth if u in predictions and len(ground_truth[u]) > 0]

    if not users:
        return {f"{m}@{k}": 0.0 for k in k_values for m in ["Precision", "Recall", "MAP", "NDCG"]}

    for k in k_values:
        p_list = [precision_at_k(ground_truth[u], predictions[u], k) for u in users]
        r_list = [recall_at_k(ground_truth[u], predictions[u], k) for u in users]
        ap_list = [average_precision_at_k(ground_truth[u], predictions[u], k) for u in users]
        ndcg_list = [ndcg_at_k(ground_truth[u], predictions[u], k) for u in users]

        results[f"Precision@{k}"] = float(np.mean(p_list))
        results[f"Recall@{k}"] = float(np.mean(r_list))
        results[f"MAP@{k}"] = float(np.mean(ap_list))
        results[f"NDCG@{k}"] = float(np.mean(ndcg_list))

    return results

