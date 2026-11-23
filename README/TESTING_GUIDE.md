# TalkWise Testing & Quality Assurance Guide

This guide details the test suites, verification procedures, and quality benchmarks for TalkWise.

---

## 1. Test Architecture Overview

| Tier | Framework | Scope / Coverage | Test Location |
| :--- | :--- | :--- | :--- |
| **ML Pipeline** | `unittest` / `scipy` | Slug normalization, text cleaning, CSR matrices, leak-free splits, evaluation metrics, cold-start fallbacks, model manager | `ml/tests/` |
| **ML Microservice** | `unittest` | Schema validation, k-clamping, secret header authentication, neighbor queries, popularity baselines | `ml/tests/test_service.py` |
| **Backend API** | Zod / Express | Request payload contracts, auth middleware, rate limits, database fallbacks | `backend/src/` |
| **Frontend** | TypeScript / React | Component rendering, optimistic state updates, route guards, design system adherence | `frontend/src/` |

---

## 2. Running ML Test Suites

Execute the comprehensive ML test suite covering all 49 test cases:

```powershell
# From repository root
.venv\Scripts\python.exe -m unittest discover ml/tests -v
```

### Verified Test Modules:
1. `ml/tests/test_preprocessing.py`:
   - Slug extraction regex and URL normalization (10 test cases)
   - Text cleaning, unicode stripping, punctuation removal
   - Tag JSON parsing and missing value imputation
   - Dataset integrity and idempotency checksum verification
2. `ml/tests/test_collaborative.py`:
   - Sparse CSR matrix dimensions and sparsity ($> 95\%$)
   - Train/test split leakage verification
   - Item-item cosine neighbor tables size ($< 1$ MB)
   - Real-time fold-in recommendation inference ($< 2$ ms)
3. `ml/tests/test_hybrid.py`:
   - Hand-computed ranking metrics: Precision@K, Recall@K, NDCG@K, MAP@K
   - Adaptive history blending weights ($0.25$, $0.50$, $0.65$)
   - Cold-start topic preference routing and popularity fallback
   - Deterministic ranking output across identical inputs
4. `ml/tests/test_service.py`:
   - `RecommendationRequest` schema validation and k clamping ($1 \le k \le 100$)
   - `X-Internal-Key` shared secret verification
   - Precomputed neighbor retrieval ($< 1$ ms)
   - `ModelManager` singleton catalog loading

---

## 3. Running Benchmark Evaluation

To reproduce the multi-seed evaluation benchmark comparing all five models:

```powershell
.venv\Scripts\python.exe ml/scripts/evaluate.py --seeds 42 43 44 45 46 --k 10
```

Results are saved to:
- `reports/evaluation_results.json`
- `reports/evaluation_report.md`
- `reports/figures/model_comparison_ndcg.png`
- `reports/figures/precision_recall_tradeoff.png`

---

## 4. Verifying Fallback & Resilience

To verify that the Express backend safely handles an ML service outage:
1. Stop the ML microservice (`taskkill` or Ctrl+C).
2. Issue a request to `GET http://localhost:5000/api/recommendations`.
3. Verify that the response returns HTTP `200 OK` with:
   ```json
   {
     "is_fallback": true,
     "fallback_reason": "ML recommendation service unavailable; displaying most popular talks snapshot."
   }
   ```
4. Verify that users never see an unhandled error or blank screen.

