# Data Validation & Quality Report: TalkWise

**Date:** November 17, 2026  
**Document ID:** `REP-DATA-VAL-01`  
**Pipeline Script:** `ml/scripts/build_dataset.py`  
**Generated Outputs:**
- `data/processed/talks_clean.csv` (SHA-256: `f066f8c81b351bd5f77c100b603e4104f429975ba39abfecb11d7d184637ef0c`)
- `data/processed/interactions.csv` (SHA-256: `7c90311810b3509cb4f8651b0266072e5a1c0f5681c7cc608e3ddb2731038bba`)
- `data/processed/slug_mapping.json`
- `data/processed/dataset_stats.json`

---

## 1. Raw Dataset Integrity & Verification

All raw data files in `data/` were verified before and after execution. Checksums are identical, confirming zero modifications:

| File Path | Records / Rows | SHA-256 Checksum | Integrity Status |
| :--- | :--- | :--- | :---: |
| `data/ted_main.csv` | 2,550 rows | `801c01b1f88181bce3dc1af7d4416df45d45f5729e6384eccb60368c00fabd6e` | **VERIFIED (Unchanged)** |
| `data/transcripts.csv` | 2,467 rows | `682b8d7e69cfabcdfabf4b0f9700190aa0f700ba0d05fa1561e6edcc4ac27556` | **VERIFIED (Unchanged)** |
| `data/TED_dataset/ted_talks-10-Sep-2012.json` | 1,203 talks | `116fdc870f9a5528de626f0b42aa7cd4b02605af8b56c069a5eecf3ac39a6e51` | **VERIFIED (Unchanged)** |
| `data/TED_dataset/ted_talks-25-Apr-2012.json` | 1,149 talks | `92f79c8cdea520a96ae6c8d948be3074d3564e50695f5def07c594694dfaa4c6` | **VERIFIED (Unchanged)** |
| `data/TED_dataset/ted_users-10-Sep-2012.json` | 12,605 users | `02d7fe3e24a8aed540e0dc6f200f013c76d6a62dbda9e683f395fc919f1498ca` | **VERIFIED (Unchanged)** |
| `data/TED_dataset/ted_users-25-Apr-2012.json` | 10,962 users | `65090557e7624747de3c924fbaa99bd154a715a20c2c3e36816af66aa650b5a5` | **VERIFIED (Unchanged)** |

---

## 2. April vs. September Snapshot: Talk ID Corruption Evidence

In accordance with Checkpoint 1 requirements, the April 2012 snapshot was profiled and compared against the September 2012 snapshot.

### Forensic Finding:
- **`ted_talks-25-Apr-2012.json`:**
  - Total talk entries: 1,149
  - **Unique Talk IDs: Only 9 unique IDs across all 1,149 talks!**
  - The crawler script in April contained a critical hashing defect: it repeatedly generated `sha1('1')`, `sha1('2')`, ..., `sha1('9')`.
  - For example, `sha1('1') = 356a192b7913b04c54574d18c28d46e6395428ab`, which is assigned to hundreds of talks.
- **`ted_talks-10-Sep-2012.json`:**
  - Total talk entries: 1,203
  - **Unique Talk IDs: Exactly 1,203 unique 40-character SHA-1 hashes (100% unique).**
  - Contains 54 additional talks and 1,643 additional user profiles.

### Formal Decision:
**Exclude the April 2012 snapshot from production modeling.** The September 10, 2012 snapshot is strictly superior in data integrity, completeness, and recency.

---

## 3. Discrepancy Analysis vs. Initial Inspection Report

The table below reconciles all statistics between the initial exploratory report (`reports/idiap_dataset_inspection.md`) and the verified production pipeline (`ml/scripts/build_dataset.py`):

| Metric | Initial Inspection Report | Verified Production ETL | Discrepancy & Explanation |
| :--- | :--- | :--- | :--- |
| **Catalog Total Talks** | 2,550 | 2,550 | **0 (Exact match)** |
| **Unique Slugs** | 2,550 | 2,550 | **0 (Exact match)** |
| **Idiap Sep 2012 Talks** | 1,203 | 1,203 | **0 (Exact match)** |
| **Matched Talks in Catalog** | 1,201 (99.83%) | 1,201 (99.83%) | **0 (Exact match)** |
| **Unmatched Talks** | 2 talks (0.17%) | 2 talks (0.17%) | **0 (Exact match: Myshkin Ingawale & Aman Mojadidi)** |
| **Catalog Cold-Start Talks** | 1,349 | 1,349 | **0 (Exact match)** |
| **Active Users ($\ge 1$ fav)** | 12,401 | 12,401 | **0 (Exact match)** |
| **Active Users ($\ge 3$ favs)** | 7,538 | 7,538 | **0 (Exact match)** |
| **Active Users ($\ge 5$ favs)** | 5,656 | 5,656 | **0 (Exact match)** |
| **Active Users ($\ge 10$ favs)** | 3,448 | 3,311 | **-137 users.** In raw data, users with multiple duplicate favorites had raw counts $\ge 10$. After deduplication on `(user_id, slug)`, 137 users shifted to 8–9 distinct favorites. |
| **Raw Mapped Interactions** | 134,456 | 134,456 | **0 (Exact match)** |
| **Deduplicated Interactions** | *Not deduplicated in report* | **129,557** | **-4,899 duplicate user-talk entries.** 4,899 instances occurred where a user had duplicate entries for the same talk in their profile. Deduplication guarantees binary implicit signal ($r_{ui} = 1$). |

---

## 4. Canonical Slug Matching Performance

The deterministic slug extraction pipeline achieved a **99.83% match rate**:

```
Idiap Raw URLs (1,203) ──► Extract Canonical Slug ──► Exact Match in ted_main.csv (1,201)
                                                  └──► Omitted by Kaggle Scraper (2)
```

### Detailed Resolution of the 2 Unmatched Talks:
1. `myshkin_ingawale_a_blood_test_without_bleeding` ("Myshkin Ingawale: A blood test without bleeding"): Delivered at TED2012. Not indexed in Kaggle's 2017 crawl. (45 favorites).
2. `a_sense_of_humor_about_afghanistan_an_artist_shows_how` ("A sense of humor about Afghanistan? Artist Aman Mojadidi shows how"): Delivered at TEDGlobal 2012. Not indexed in Kaggle's 2017 crawl. (32 favorites).

Both talks were excluded from `interactions.csv` cleanly without fabrication, representing only 77 total favorites (0.057% of raw interactions).

---

## 5. Output Datasets Quality & Profiling

### 5.1 `data/processed/talks_clean.csv` (2,550 talks)
- **Primary Key:** `slug` (100% unique string).
- **Missing Values:**
  - `title`: 0 nulls, 0 empty strings.
  - `main_speaker`: 0 nulls ("Unknown" filled for missing).
  - `description`: 0 nulls.
  - `duration_seconds`: 0 nulls (min: 135s, median: 848s, max: 5,256s).
  - `views`: 0 nulls (min: 50,443, median: 1,124,524, max: 47,227,110).
  - `has_transcript`: 2,464 talks `True` (96.6%), 86 talks `False` (3.4%).
  - `has_interactions`: 1,201 talks `True` (47.1%), 1,349 talks `False` (52.9%).
  - `combined_text`: 0 nulls, 0 empty strings. Mean length: 12,854 characters.

### 5.2 `data/processed/interactions.csv` (129,557 rows)
- **Columns:** `user_id` (string), `slug` (string), `signal` (integer: 1).
- **Deduplication:** Exactly 0 duplicate pairs of `(user_id, slug)`.
- **Integrity:** Every single `slug` in `interactions.csv` is confirmed to exist in `talks_clean.csv` (0 orphan references).
- **Active User Count:** 12,401 users.
- **Active Talk Count:** 1,201 talks.

---

## 6. Unit Testing Summary

Automated tests in `ml/tests/test_preprocessing.py`:
- 17 test cases executed via `unittest`.
- Tested edge cases: protocol stripping, trailing `.html`, query parameters, URL fragments, trailing newlines, lowercase normalization.
- Tested referential integrity and zero blank text fields.
- Tested pipeline idempotency (identical SHA-256 output hashes across runs).
- **Result:** **17 Passed, 0 Failed (100% Pass Rate).**

