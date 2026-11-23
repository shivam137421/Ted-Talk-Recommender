# Checkpoint 3: Hybrid Recommendation & Multi-Seed Evaluation Evidence

**Date:** November 17, 2026  
**Checkpoint:** CP3 (Hybrid Recommendation and Evaluation)  
**Status:** PASS  

---

## 1. Execution of Content Feature Pipeline

### Command:
```powershell
.venv\Scripts\python ml/scripts/train_content_and_hybrid.py
```

### Log Output:
```text
2026-11-17 19:47:06,214 [INFO] === Starting TalkWise Content Feature Pipeline ===
2026-11-17 19:47:06,372 [INFO] Loaded catalog of 2550 talks.
2026-11-17 19:47:06,372 [INFO] Fitting TF-IDF vectorizer on weighted talk text corpus...
2026-11-17 19:47:19,196 [INFO] TF-IDF matrix shape: (2550, 12000), non-zero entries: 1196066
2026-11-17 19:47:19,196 [INFO] Building Content-Based Model and precomputing top-50 neighbor tables...
2026-11-17 19:47:19,483 [INFO] Precomputing top-50 content neighbors for 2550 talks...
2026-11-17 19:47:21,364 [INFO] Saving TF-IDF vectorizer to ml\artifacts\content\tfidf_vectorizer.joblib...
2026-11-17 19:47:21,694 [INFO] Saving sparse TF-IDF matrix to ml\artifacts\content\tfidf_matrix.npz...
2026-11-17 19:47:22,820 [INFO] Saving compact neighbor tables to ml\artifacts\content\content_neighbors.joblib...
2026-11-17 19:47:22,888 [INFO] Content Artifact Sizes: Vectorizer=0.13 MB, Matrix=9.60 MB, Neighbors=0.66 MB (Total: 10.39 MB)
2026-11-17 19:47:22,889 [INFO] Saved metadata to ml\artifacts\content\metadata.json.
2026-11-17 19:47:22,898 [INFO] 
Sanity check Content Recs for 'ken_robinson_says_schools_kill_creativity':
2026-11-17 19:47:22,899 [INFO]   1. sir_ken_robinson_bring_on_the_revolution (Cosine Sim: 0.2360)
2026-11-17 19:47:22,899 [INFO]   2. ken_robinson_how_to_escape_education_s_death_valley (Cosine Sim: 0.2327)
2026-11-17 19:47:22,899 [INFO]   3. bill_strickland_makes_change_with_a_slide_show (Cosine Sim: 0.1980)
2026-11-17 19:47:22,899 [INFO]   4. jarrett_j_krosoczka_how_a_boy_became_an_artist (Cosine Sim: 0.1965)
2026-11-17 19:47:22,899 [INFO]   5. mae_jemison_on_teaching_arts_and_sciences_together (Cosine Sim: 0.1876)
2026-11-17 19:47:22,899 [INFO] === Content Feature Pipeline Completed Successfully ===
```

---

## 2. Multi-Seed Benchmark Evaluation Run

### Command:
```powershell
.venv\Scripts\python ml/scripts/evaluate.py
```

### Log Output & Summary Table:
```text
==========================================================================================
FINAL MULTI-SEED EVALUATION RESULTS (MEAN ± STD ACROSS 5 FIXED SEEDS)
==========================================================================================
Model            | Precision@10     | Recall@10        | NDCG@10          | Catalog Coverage
------------------------------------------------------------------------------------------
Random           | 0.0020±0.0004    | 0.0047±0.0018    | 0.0033±0.0011    | 99.9%           
Popularity       | 0.0354±0.0018    | 0.1128±0.0036    | 0.0884±0.0050    | 1.7%            
Content-Based    | 0.0141±0.0011    | 0.0542±0.0056    | 0.0356±0.0039    | 37.2%           
Collaborative    | 0.0473±0.0025    | 0.1451±0.0046    | 0.1121±0.0062    | 35.3%           
Hybrid           | 0.0483±0.0029    | 0.1490±0.0066    | 0.1156±0.0077    | 34.8%           
==========================================================================================
```

### Key Analytical Conclusions:
1. **Hybrid model is the empirical winner**, outperforming pure Collaborative Filtering by +2.7% on Recall@10 and +3.1% on NDCG@10, and outperforming Popularity by +32.1% on Recall@10 and +30.8% on NDCG@10.
2. **Catalog Coverage vs Popularity Trap:** Popularity achieves a high raw hit rate on the head of the distribution but covers only **1.7%** of the catalog (recommending the same ~40 talks). Hybrid achieves **34.8%** coverage, surfacing deep catalog items across varied topics.
3. **Item Cold-Start:** In experiments with held-out unobserved items (post-2012 simulation), Collaborative Filtering and Popularity failed completely (Recall@10 = **0.0000**), whereas Content-Based and Hybrid successfully surfaced the cold items.

---

## 3. Unit Tests Execution

### Command:
```powershell
.venv\Scripts\python -m unittest discover -s ml/tests
```

### Output:
```text
...................................
----------------------------------------------------------------------
Ran 35 tests in 5.047s

OK
```

---

## 4. Generated Artifacts & Reports

- `reports/evaluation_results.json`
- `reports/evaluation_report.md`
- `reports/figures/model_comparison_ndcg.png`
- `reports/figures/precision_recall_tradeoff.png`
- `ml/artifacts/content/tfidf_vectorizer.joblib`
- `ml/artifacts/content/tfidf_matrix.npz`
- `ml/artifacts/content/content_neighbors.joblib`
- `ml/artifacts/content/metadata.json`

