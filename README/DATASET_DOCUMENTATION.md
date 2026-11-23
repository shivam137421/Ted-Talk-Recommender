# Dataset Documentation: TalkWise

This document provides exhaustive documentation of all raw datasets, licensing requirements, cleaning steps, matching logic, and schema definitions.

---

## 1. Primary Dataset Sources & Provenance

### 1.1 Kaggle TED Talks Dataset (`ted_main.csv` & `transcripts.csv`)
- **Origin:** Kaggle TED Talks dataset scraped by Rounak Banik from official `ted.com` pages up to September 21, 2017.
- **License:** CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International).
- **Contents:**
  - `ted_main.csv`: 2,550 TED Talks with 17 metadata attributes.
  - `transcripts.csv`: 2,467 transcripts mapped by URL.

### 1.2 Idiap TED Recommendation Dataset (`data/TED_dataset/`)
- **Origin:** Curated by Nikolaos Pappas and Andrei Popescu-Belis at the Idiap Research Institute, Martigny, Switzerland. Published on Zenodo (2013).
- **Academic References:**
  1. N. Pappas, A. Popescu-Belis, *"Combining Semantic Content with User Preferences for TED Lecture Recommendation"*, IEEE CBMI 2013.
  2. N. Pappas, A. Popescu-Belis, *"Sentiment Analysis of User Comments for One-Class Collaborative Filtering over TED Talks"*, ACM SIGIR 2013.
- **License:** **Creative Commons Attribution-NonCommercial-NoDerivs 3.0 Unported (CC BY-NC-ND 3.0)**.
- **License Compliance:** Strictly non-commercial academic and coursework usage. Redistribution of modified raw datasets is prohibited; internal processing into numerical interaction matrices is fully compliant.

---

## 2. Talk Matching Methodology (Canonical URL Slug)

### 2.1 The Problem with Raw Identifiers
- Talk IDs in the Idiap dataset are proprietary 40-character SHA-1 hashes not found in the Kaggle CSV or on TED.com.
- In `ted_talks-25-Apr-2012.json`, the talk `id` field is corrupted (only 9 unique hashes across 1,149 talks, repeatedly hashing single digits).
- In `ted_main.csv`, URLs contain trailing `\n` characters, and Idiap URLs end with `.html`.
- Talk titles in Idiap include the speaker prefix (`Speaker: Title`), which corresponds to `name` in `ted_main.csv`, while `title` contains only the talk title.

### 2.2 The Deterministic Matching Rule
To guarantee 100% deterministic, collision-free matching, the system extracts the canonical **URL slug**:
```python
def extract_canonical_slug(url: str) -> str:
    if not isinstance(url, str):
        return ""
    # Strip whitespace, newlines, and trailing characters
    u = url.strip().strip("\r\n\t /")
    # Remove protocol and domain
    u = re.sub(r"^https?://(www\.)?ted\.com/talks/", "", u)
    # Remove .html extension
    u = re.sub(r"\.html$", "", u)
    # Remove query parameters and trailing slashes
    u = u.split("?")[0].strip("/")
    return u.lower()
```

### 2.3 Verification Results
- **Idiap Sep 2012 talks:** 1,203 total talks.
- **Matched to `ted_main.csv` via canonical slug:** **1,201 talks (99.83%)**.
- **Unmatched talks (2 talks, 0.17%):**
  1. `myshkin_ingawale_a_blood_test_without_bleeding`
  2. `a_sense_of_humor_about_afghanistan_an_artist_shows_how`
  *(Both were delivered at TED in 2012 but omitted by Kaggle's 2017 crawl; accounts for only 77 total favorites out of 134,533).*
- **Transcripts match rate:** 100% of the 1,201 overlapping talks have matching transcripts in `transcripts.csv`.

---

## 3. User Interaction Dataset (`interactions.csv`)

### 3.1 Interaction Schema & Extraction
From `ted_users-10-Sep-2012.json` (12,605 unique users):
- Each favorite string is mapped to its canonical slug using the verified mapping table.
- Total raw favorites: 134,533.
- Total mapped favorites: **134,456 (99.94%)**.
- Active users with $\ge 1$ mapped favorite: **12,401 users**.
- Active users with $\ge 5$ mapped favorites (evaluation cohort): **5,656 users**.

### 3.2 Output Files (`data/processed/`)
1. `data/processed/talks_clean.csv`: Cleaned catalog of 2,550 talks with parsed tags, clean slugs, duration in seconds, speaker names, timestamps, and transcript flags.
2. `data/processed/interactions.csv`: Cleaned user-talk interaction table (`user_id`, `slug`, `signal=1`).
3. `data/processed/slug_mapping.json`: Mapping between talk slugs and integer matrix indices.

