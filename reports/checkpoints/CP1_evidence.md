# Checkpoint 1: Dataset Validation & Preprocessing Evidence

**Date:** November 17, 2026  
**Checkpoint:** CP1 (Dataset Validation and Preprocessing)  
**Status:** PASS  

---

## 1. Execution of Dataset Build Script

### Command:
```powershell
.venv\Scripts\python ml/scripts/build_dataset.py
```

### Log Output:
```text
2026-11-17 19:33:26,731 [INFO] === Starting TalkWise Dataset Build Pipeline ===
2026-11-17 19:33:26,733 [INFO] Step 1: Cleaning talks catalog and merging transcripts...
2026-11-17 19:33:26,733 [INFO] Loading raw datasets from data\ted_main.csv and data\transcripts.csv
2026-11-17 19:33:27,342 [INFO] Catalog shape after cleaning: (2550, 29)
2026-11-17 19:33:27,342 [INFO] Step 2: Processing Idiap user interactions...
2026-11-17 19:33:27,342 [INFO] Loading Idiap JSON datasets from data\TED_dataset\ted_talks-10-Sep-2012.json and data\TED_dataset\ted_users-10-Sep-2012.json
2026-11-17 19:33:30,790 [INFO] Deduplicated interactions count: 129557
2026-11-17 19:33:30,790 [INFO] Stats: {
  "raw_users_count": 12605,
  "raw_favorites_count": 134533,
  "mapped_interactions_total": 134456,
  "mapped_interactions_deduped": 129557,
  "unmapped_favorites_count": 77,
  "unique_unmapped_titles": 2,
  "active_users_ge_1": 12401,
  "active_users_ge_3": 7538,
  "active_users_ge_5": 5656,
  "active_users_ge_10": 3311,
  "catalog_talks_total": 2550,
  "catalog_talks_with_interactions": 1201,
  "catalog_talks_cold_start": 1349
}
2026-11-17 19:33:30,830 [INFO] Writing clean talks to data\processed\talks_clean.csv...
2026-11-17 19:33:33,641 [INFO] Writing interactions to data\processed\interactions.csv...
2026-11-17 19:33:34,106 [INFO] Writing slug mapping to data\processed\slug_mapping.json...
2026-11-17 19:33:34,121 [INFO] Writing dataset stats to data\processed\dataset_stats.json...
2026-11-17 19:33:34,443 [INFO] Output Checksums:
2026-11-17 19:33:34,443 [INFO]   talks_clean.csv: f066f8c81b351bd5f77c100b603e4104f429975ba39abfecb11d7d184637ef0c
2026-11-17 19:33:34,443 [INFO]   interactions.csv: 7c90311810b3509cb4f8651b0266072e5a1c0f5681c7cc608e3ddb2731038bba
2026-11-17 19:33:34,443 [INFO] === Dataset Build Pipeline Completed Successfully ===
```

---

## 2. Unit Tests Execution

### Command:
```powershell
.venv\Scripts\python -m unittest ml/tests/test_preprocessing.py
```

### Output:
```text
.................
----------------------------------------------------------------------
Ran 17 tests in 0.885s

OK
```

---

## 3. Raw Data Immutability Check

### Pre-run & Post-run SHA-256 Checksums:
```text
data/ted_main.csv:
  Pre:  801c01b1f88181bce3dc1af7d4416df45d45f5729e6384eccb60368c00fabd6e
  Post: 801c01b1f88181bce3dc1af7d4416df45d45f5729e6384eccb60368c00fabd6e  [MATCH]

data/transcripts.csv:
  Pre:  682b8d7e69cfabcdfabf4b0f9700190aa0f700ba0d05fa1561e6edcc4ac27556
  Post: 682b8d7e69cfabcdfabf4b0f9700190aa0f700ba0d05fa1561e6edcc4ac27556  [MATCH]

data/TED_dataset/ted_talks-10-Sep-2012.json:
  Pre:  116fdc870f9a5528de626f0b42aa7cd4b02605af8b56c069a5eecf3ac39a6e51
  Post: 116fdc870f9a5528de626f0b42aa7cd4b02605af8b56c069a5eecf3ac39a6e51  [MATCH]

data/TED_dataset/ted_users-10-Sep-2012.json:
  Pre:  02d7fe3e24a8aed540e0dc6f200f013c76d6a62dbda9e683f395fc919f1498ca
  Post: 02d7fe3e24a8aed540e0dc6f200f013c76d6a62dbda9e683f395fc919f1498ca  [MATCH]
```
**Conclusion:** All raw dataset files remain bit-for-bit unchanged.

