# Checkpoint 8 Evidence: Testing & Quality Assurance

**Date:** November 17, 2026  
**Checkpoint:** Checkpoint 8 (Testing & Quality Assurance)  
**Status:** **PASS**

---

## 1. Test Execution Summary

### ML Pipeline & Model Tests:
- **Preprocessing Suite (`ml/tests/test_preprocessing.py`):** 17 tests passed.
  - URL slug extraction, trailing slash stripping, punctuation normalization.
  - Verification that raw dataset files were bit-for-bit unchanged before and after ETL.
- **Collaborative Filtering Suite (`ml/tests/test_collaborative.py`):** 7 tests passed.
  - Verification that user-item interaction matrix has $> 95\%$ sparsity.
  - Split leakage verification (zero train/test overlap).
  - Sub-2ms real-time fold-in recommendation latency.
- **Hybrid Scorer & Metrics Suite (`ml/tests/test_hybrid.py`):** 11 tests passed.
  - Hand-computed Precision@K, Recall@K, MAP@K, NDCG@K formulas.
  - User cold-start and item cold-start fallbacks.
  - Blending weight boundaries.
- **ML Microservice Suite (`ml/tests/test_service.py`):** 14 tests passed.
  - Schemas, k-clamping, `X-Internal-Key` security, cosine neighbors.

**Total Test Suite: 49 tests executed in 4.708s — 100% PASS.**

---

## 2. Security & Fallback Verification
- Header security: `POST /recommend` rejects missing or incorrect `X-Internal-Key` with HTTP 401.
- Database fallback: If ML service is offline, Express automatically queries Supabase `talks` table and returns valid talks with `is_fallback: true`.
- Zero raw secrets in repository or code.

