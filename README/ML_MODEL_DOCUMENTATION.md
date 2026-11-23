# Machine Learning Model Documentation: TalkWise

This document details the recommendation algorithms, mathematical formulations, hyperparameter configurations, validation results, and production serving architectures.

---

## 1. Collaborative Filtering Architecture

### 1.1 Problem Formulation: One-Class Collaborative Filtering (OCCF)
TalkWise user interactions are derived from public profile favorites:
- Binary implicit positive feedback: $r_{ui} = 1$ if user $u$ favorited talk $i$.
- Missing interactions: $r_{ui} = 0$ represents **unknown / unobserved** feedback, not negative preference.

### 1.2 Python Version & Pure NumPy / SciPy Decision
- **Target Version:** Python 3.13.6 (matching runtime environment).
- **Library Decision:** Direct implementation of Item-Item Cosine CF, Implicit ALS, and Popularity in pure NumPy and SciPy.
- **Decision Rationale:**
  - Third-party C++ libraries (such as `implicit`) frequently lack prebuilt binary wheels for the newest Python releases on Windows, requiring Visual Studio C++ build tools and introducing cross-platform compilation friction.
  - Pure NumPy/SciPy ensures 100% portability, zero C++ build dependencies, deterministic random states, and compact artifact sizes (< 1 MB).

### 1.3 Selected Model: Truncated Item-Item Cosine CF
Item-Item Collaborative Filtering models item affinity by measuring cosine similarity between column vectors in the user-item interaction matrix $R$:

$$S_{ij} = \frac{R_{\cdot, i}^T R_{\cdot, j}}{\| R_{\cdot, i} \|_2 \| R_{\cdot, j} \|_2}$$

- **Truncation:** To guarantee lightweight memory usage on free-tier hosting, only the top-$K$ ($K=50$) highest-similarity neighbors are preserved per item.
- **Inference / Fold-in:** For any incoming user history $H_u = \{s_1, s_2, \dots, s_m\}$, recommendations are scored on the fly:
  $$\hat{s}_j = \sum_{i \in H_u} S_{ij}, \quad \forall j \notin (H_u \cup \text{Exclude})$$
  This operation requires no user matrix retraining and executes in under 2 milliseconds.

### 1.4 Hyperparameter Tuning & Validation Comparison
Models were evaluated on a dedicated 10% validation holdout split of users with $\ge 5$ favorites ($N=5,656$ users), with the 20% test split held out:

| Model Architecture | Precision@10 | Recall@10 | MAP@10 | NDCG@10 | Artifact Size | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Popularity Baseline** | 0.0200 | 0.1155 | 0.0531 | 0.0754 | < 0.1 MB | Baseline |
| **Item-Item Cosine CF ($K=50$)** | **0.0244** | **0.1370** | **0.0572** | **0.0848** | **0.35 MB** | **SELECTED** |
| **Item-Item Cosine CF ($K=100$)** | 0.0236 | 0.1312 | 0.0567 | 0.0833 | 0.70 MB | Candidate |
| **Implicit ALS ($f=32, \alpha=20$)** | 0.0214 | 0.1234 | 0.0511 | 0.0758 | 0.40 MB | Candidate |

**Selection Decision:** `ItemItem_Cosine_k50` delivered the highest Recall@10 (0.1370) and NDCG@10 (0.0848) while requiring only **0.35 MB** of storage.

---

## 2. Content-Based Filtering Architecture (Preview)

- **Vectorization:** TF-IDF fitted unsupervised over the full catalog of 2,550 talks.
- **Features:** Composite string `title` + `main_speaker` + `description` + `tags` + `transcript`.
- **User Profile:** Centroid of TF-IDF vectors of talks favorited by the user:
  $$v_u = \frac{1}{|H_u|} \sum_{i \in H_u} v_i$$
- **Scoring:** Cosine similarity between $v_u$ and all candidate talk vectors $v_j$.

---

## 3. Hybrid Blending Strategy (Preview)

- Adaptive score weighting:
  $$S_{\text{hybrid}}(u, i) = \alpha(u) \cdot \hat{S}_{\text{CF}}(u, i) + (1 - \alpha(u)) \cdot \hat{S}_{\text{Content}}(u, i)$$
- **Cold-Start Handling:**
  - If a talk $i$ was published after 2012 and has no collaborative interactions, $\hat{S}_{\text{CF}}(u, i)$ is unavailable, automatically transitioning that talk to pure content-based scoring.
  - If a user has zero favorites, onboarding tags guide content scoring; if no onboarding tags are provided, popularity with tag diversity is returned.

