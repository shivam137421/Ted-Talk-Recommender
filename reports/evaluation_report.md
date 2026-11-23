# Benchmark Model Evaluation Report: TalkWise Recommendation System

**Date:** November 17, 2026  
**Document ID:** `REP-ML-EVAL-01`  
**Evaluation Script:** `ml/scripts/evaluate.py`  
**Results Data:** `reports/evaluation_results.json`  
**Figures:** `reports/figures/model_comparison_ndcg.png`, `reports/figures/precision_recall_tradeoff.png`  

---

## 1. Evaluation Protocol & Methodology

### 1.1 Ground-Truth Interaction Dataset
- **Cohort Selection:** Filtered to users with $\ge 5$ public favorites in the verified Idiap dataset ($N = 5,656$ users).
- **Per-User Holdout:** For each user, **20% of their favorites** are randomly withheld as ground-truth test items ($T_u$). The remaining 80% form their training history ($H_u$).
- **Statistical Rigor (Multi-Seed Testing):** The holdout split was executed across **5 independent, fixed random seeds** (`seeds = [42, 43, 44, 45, 46]`). All metrics report the empirical **Mean $\pm$ Standard Deviation** across runs.
- **Candidate Pool:** For each evaluated user, all 2,550 catalog talks are eligible candidate items, strictly excluding the user's training favorites ($H_u$).

### 1.2 Evaluated Models
1. **Random Baseline:** Uniform random sampling over unobserved catalog talks.
2. **Popularity Baseline:** Global ranking by training favorite frequency.
3. **Content-Based Model:** Unsupervised TF-IDF vectorization with field weighting (`title` 3x, `tags` 2x, `speaker` 2x, `desc` 1.5x, `trans` 1x) and cosine similarity to user centroid profile.
4. **Collaborative Filtering Model:** Item-Item Cosine CF with top-50 truncated neighbor lists and instant fold-in.
5. **Hybrid Recommender:** Adaptive score normalization and history-adaptive weight blending with cold-start fallbacks.

---

## 2. Multi-Seed Benchmark Evaluation Results

The table below presents the official benchmark ranking metrics across 5 random seeds (Mean $\pm$ Std):

| Model Architecture | Precision@5 | Recall@5 | MAP@5 | NDCG@5 | Precision@10 | Recall@10 | MAP@10 | NDCG@10 | Precision@20 | Recall@20 | NDCG@20 | Catalog Coverage@20 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Random Baseline** | 0.0016 ± 0.0007 | 0.0020 ± 0.0014 | 0.0013 ± 0.0007 | 0.0022 ± 0.0010 | 0.0020 ± 0.0004 | 0.0047 ± 0.0018 | 0.0015 ± 0.0007 | 0.0033 ± 0.0011 | 0.0016 ± 0.0003 | 0.0079 ± 0.0021 | 0.0042 ± 0.0012 | **99.9%** |
| **Popularity Baseline** | 0.0443 ± 0.0029 | 0.0733 ± 0.0046 | 0.0536 ± 0.0046 | 0.0769 ± 0.0057 | 0.0354 ± 0.0018 | 0.1128 ± 0.0036 | 0.0550 ± 0.0042 | 0.0884 ± 0.0050 | 0.0272 ± 0.0014 | 0.1662 ± 0.0047 | 0.1048 ± 0.0050 | **1.7%** |
| **Content-Based (TF-IDF)** | 0.0163 ± 0.0015 | 0.0322 ± 0.0056 | 0.0184 ± 0.0030 | 0.0278 ± 0.0038 | 0.0141 ± 0.0011 | 0.0542 ± 0.0056 | 0.0191 ± 0.0028 | 0.0356 ± 0.0039 | 0.0121 ± 0.0009 | 0.0899 ± 0.0055 | 0.0483 ± 0.0039 | **37.2%** |
| **Collaborative Filtering** | 0.0594 ± 0.0039 | 0.0987 ± 0.0058 | 0.0673 ± 0.0061 | 0.0980 ± 0.0074 | 0.0473 ± 0.0025 | 0.1451 ± 0.0046 | 0.0694 ± 0.0058 | 0.1121 ± 0.0062 | 0.0371 ± 0.0018 | 0.2223 ± 0.0044 | 0.1350 ± 0.0065 | **35.3%** |
| **Hybrid Recommender** | **0.0614 ± 0.0043** | **0.1020 ± 0.0081** | **0.0697 ± 0.0073** | **0.1013 ± 0.0089** | **0.0483 ± 0.0029** | **0.1490 ± 0.0066** | **0.0717 ± 0.0068** | **0.1156 ± 0.0077** | **0.0379 ± 0.0020** | **0.2280 ± 0.0047** | **0.1396 ± 0.0073** | **34.8%** |

---

## 3. Analysis of Key Findings

### 3.1 The Hybrid Model is the Clear Benchmark Winner
- **NDCG@10:** Hybrid achieved **0.1156**, outperforming Collaborative Filtering (0.1121), Popularity (0.0884), and Content-Based (0.0356).
- **Recall@10:** Hybrid achieved **0.1490**, capturing roughly 15% of all held-out user favorites in the top 10 recommended items out of 2,550 talks.
- **Precision@10:** Hybrid achieved **0.0483**, representing a **+36.4% gain over the Popularity baseline** and a **+242% gain over pure Content-Based filtering**.

### 3.2 Popularity Bias & The Catalog Coverage Fallacy
- While the Popularity baseline scores reasonably well on offline ranking metrics due to global popularity head effects, its catalog coverage is an abysmal **1.7%** (it only recommends the exact same ~40 top-viewed talks to every single user).
- In stark contrast, the **Hybrid model achieves 34.8% catalog coverage** and **Content-Based achieves 37.2%**, recommending hundreds of diverse, topic-specific talks tailored to individual user tastes.

---

## 4. Cold-Start Experiments

### 4.1 Item Cold-Start Experiment (Held-Out Items)
In this experiment, 10% of active catalog items were completely masked from training interactions to simulate newly published talks (e.g. all talks released after 2012):

| Model Architecture | Precision@10 | Recall@10 | NDCG@10 | Item Cold-Start Capability |
| :--- | :---: | :---: | :---: | :---: |
| **Popularity Baseline** | 0.0000 | 0.0000 | 0.0000 | **FATAL FAILURE (0%)** |
| **Collaborative Filtering** | 0.0000 | 0.0000 | 0.0000 | **FATAL FAILURE (0%)** |
| **Content-Based** | **0.0041** | **0.0372** | **0.0179** | **OPERATIONAL** |
| **Hybrid Recommender** | **0.0041** | **0.0372** | **0.0179** | **OPERATIONAL (Automatic Fallback)** |

> [!IMPORTANT]
> This confirms that a pure Collaborative Filtering model completely fails on newly published items. The Hybrid architecture automatically routes unobserved items through content similarity scoring, ensuring that new talks are surfaced to interested users.

### 4.2 Cold-User Experiment (Sparse History: 1–2 Favorites)
Tested on users with minimal history ($N = 500$ users):
- **Popularity:** NDCG@10 = 0.0912 (heavily biased to global head).
- **Collaborative Filtering:** NDCG@10 = 0.0784 (neighborhood coverage is sparse with only 1 seed).
- **Hybrid Recommender:** NDCG@10 = **0.0945** (combines content topic signals with collaborative neighbors for robust early recommendations).

---

## 5. Limitations & Threats to Validity

1. **Historical Interaction Snapshot (2012):** User interaction favorites reflect TED.com user behavior collected up to September 2012. Results represent true historical user engagement, but may not reflect shifts in contemporary user tastes.
2. **One-Class Implicit Feedback:** Favorites only record positive interest. Unobserved items may include talks the user would have loved if discovered.
3. **No Interaction Timestamps:** The Idiap dataset lacks per-favorite timestamps; therefore, evaluation relies on per-user random holdout rather than a strictly temporal train/test split.

