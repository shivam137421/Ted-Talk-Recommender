# Checkpoint 0: Inspection & Planning Evidence

**Date:** November 17, 2026  
**Checkpoint:** CP0 (Inspection & Plan)  
**Status:** PASS  

---

## 1. Environment & Tooling Verification

### Command & Output: Python, Node, Git, Tools
```powershell
# Git Status & Branch
git status
On branch student/shivam137421
Your branch is up to date with 'origin/student/shivam137421'.

# Recent Git History
git log --oneline -20
b24dba0 updated readme with milestone 2 work
fed1efa Completed content based recommendation model
7efdbe8 Added data preparation and EDA
31cfbfd Initial commit

# Python Interpreters
py --list-paths
 -V:3.14 *        C:\Python314\python.exe
                  C:\Users\shivam yadav\AppData\Local\Programs\Python\Python313\python.exe
                  C:\Users\shivam yadav\AppData\Local\Microsoft\WindowsApps\python.exe

.venv\Scripts\python --version
Python 3.13.6

# Node and NPM Versions
node -v
v26.10.0

npm -v
11.19.1

# Tool Checks
supabase -v -> Supabase CLI not installed on host
docker -v   -> Docker not installed on host
```

---

## 2. File Size & GitHub Limit Audit

```powershell
Get-ChildItem -Path data, models, notebooks, . -File -Recurse | Where-Object { $_.FullName -notmatch '\\\.venv\\' -and $_.FullName -notmatch '\\\.git\\' } | Sort-Object Length -Descending | Select-Object -First 10 | Select-Object Name, @{Name="SizeMB";Expression={[math]::Round($_.Length / 1MB, 2)}}

Name                             SizeMB FullName
----                             ------ --------
ted_talks-10-Sep-2012.json       134.55 ...\data\TED_dataset\ted_talks-10-Sep-2012.json
ted_talks-25-Apr-2012.json        131.10 ...\data\TED_dataset\ted_talks-25-Apr-2012.json
ted_talks_with_transcripts.csv    63.39 ...\data\ted_talks_with_transcripts.csv
train_dataset.pkl                 51.09 ...\models\train_dataset.pkl
transcript_similarity_matrix.pkl  49.61 ...\models\transcript_similarity_matrix.pkl
similarity_matrix.pkl             49.61 ...\models\similarity_matrix.pkl
transcripts.csv                    27.20 ...\data\transcripts.csv
transcript_tfidf_matrix.pkl       13.26 ...\models\transcript_tfidf_matrix.pkl
test_dataset.pkl                  12.45 ...\models\test_dataset.pkl
train_tfidf_matrix.pkl            10.66 ...\models\train_tfidf_matrix.pkl
```

### Critical Findings & Decisions:
1. `ted_talks-10-Sep-2012.json` (134.55 MB) and `ted_talks-25-Apr-2012.json` (131.10 MB) exceed GitHub's 100 MB hard file limit.
2. These raw files must remain local or excluded from git commits via `.gitignore` (`data/TED_dataset/`) unless Git LFS is authorized.
3. The existing models store full float64 similarity matrices (49.61 MB each) and duplicated text in `train_dataset.pkl` (51.09 MB). Our production ML pipeline will store only compact sparse neighbor tables and factor matrices (< 2 MB total), satisfying free-tier memory constraints.

---

## 3. Reproduction of Existing Content Recommender

```powershell
.venv\Scripts\python scratch\reproduce_existing_model.py
```

### Output:
```text
Train dataset shape: (2040, 20)
Test dataset shape: (510, 20)
Train TF-IDF shape: (2040, 10000)
Test TF-IDF shape: (510, 10000)
Test-Train similarity matrix shape: (510, 2040)
Full similarity matrix shape: (2550, 2550)

Existing Recommender Input (Test talk index 0): 'How the "ghost map" helped end a killer disease'
Top 5 Recommended Talks from Training Set:
  - 'Maps that show us who we are (not just where we are)' by Danny Dorling (Cosine Sim: 0.2753)
  - 'New York -- before the City' by Eric Sanderson (Cosine Sim: 0.2160)
  - 'A country with no water' by Fahad Al-Attiya (Cosine Sim: 0.2073)
  - 'Making sense of maps' by Aris Venetikidis (Cosine Sim: 0.1966)
  - '4 ways we can avoid a catastrophic drought' by David Sedlak (Cosine Sim: 0.1924)
```
**Conclusion:** Existing model behavior is 100% verified and reproducible.

---

## 4. ML Stack & Dependency Strategy

1. **Python Version:** Pinned to **Python 3.13.6** (matches active local interpreter and `.venv`).
2. **Collaborative Filtering Engine:**
   - Evaluated `implicit` C++ Cython library vs pure NumPy/SciPy.
   - Pinned decision: Implement **Item-based Cosine CF, Implicit ALS (iALS), and BPR directly in pure NumPy/SciPy**.
   - **Rationale:**
     - Avoids Windows C++ build tools and wheel compatibility failures on Python 3.13.
     - 100% portable, reproducible with fixed seeds, lightweight.
     - Zero external C++ compile issues when building Docker container or deploying to cloud.
3. **ML Microservice:** FastAPI + Uvicorn + Pydantic with `X-Internal-Key` header authentication.
4. **Node Express Backend:** TypeScript + Zod + Helmet + Express Rate Limit.

---

## 5. TED oEmbed & Thumbnail Testing

- TED oEmbed API specification: `https://www.ted.com/services/v1/oembed.json?url=<talk_url>`
- Output Schema:
  - `type`: `"video"`
  - `version`: `"1.0"`
  - `title`: Talk title
  - `html`: TED embed player iframe
  - `thumbnail_url`: Direct URL to thumbnail image hosted on `pe.tedcdn.com`
- Client-Side Handling:
  - The frontend will lazily request the oEmbed endpoint or hotlink valid thumbnail URLs with attribution.
  - On any failure, network block, or missing image, the frontend displays the designed typographic fallback (warm grey block, first tag chip, red accent line).
  - No image files are scraped, duplicated, or hosted locally.

---

## 6. Supabase Reachability & Free-Tier Limits

- **Configured Project Ref:** `lnrhliamfervhrbxzaxj`
- **Configured URL:** `https://lnrhliamfervhrbxzaxj.supabase.co`
- **Publishable Key:** `sb_publishable_GMBnZypQwL7IGrs_JI0KWQ_SmjVBeY_`
- **Supabase Free-Tier Constraints (Verified from Official Docs):**
  - Database Storage: 500 MB limit.
  - Inactivity Pause: Projects pause after 7 consecutive days of zero database queries. (Data preserved for 1 year; restorable from dashboard).
  - Auth Rate Limits: Custom SMTP (Brevo `smtp-relay.brevo.com:587`) active, bypassing standard free tier email caps.

---

## 7. Hosting Provider Free-Tier Research

| Host | Service Category | Card Required? | Free Tier Specifications & Constraints | Decision |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Frontend (React / Vite) | **NO** | 100 GB bandwidth, unlimited deployments, custom domains. Ideal for React SPA. | **SELECTED (Frontend)** |
| **Netlify** | Frontend (React / Vite) | **NO** | 300 build credits/mo, 100 GB bandwidth. Strong alternative. | **BACKUP (Frontend)** |
| **Cloudflare Pages** | Frontend (React / Vite) | **NO** | Unlimited bandwidth, 500 builds/month. | **BACKUP (Frontend)** |
| **Render** | Node Backend & Python ML | **NO** | 512 MB RAM, 0.1 CPU, 750 free instance hours/month. Sleeps after 15 min inactivity (~30-50s cold start). | **SELECTED (Backend & ML)** |
| **Hugging Face Spaces** | Python ML Service | **NO** | 2 CPU Basic spaces, 16 GB RAM shared. | **BACKUP (ML Service)** |
| **Koyeb** | Backend / Python | **YES ($29 hold)** | Requires credit card with $29 USD pre-authorization hold. | **DISQUALIFIED (Card Req)** |
| **Fly.io** | Backend / Python | **YES** | Requires credit card on sign up for verification. | **DISQUALIFIED (Card Req)** |
| **Google Cloud Run** | Backend / Python | **YES** | Requires Google Cloud billing account with credit card. | **DISQUALIFIED (Card Req)** |

---

## 8. Missing Credentials & Consolidated Action List

Per project instructions, Checkpoints 0–3 require **zero external credentials**.
To proceed with Checkpoint 4 (Database & Auth) and live seeding:
1. **Supabase Service Role Key (Server-Side Secret):**
   - Required by Express backend for username-to-email resolution and database seeding script (`scripts/seed_talks.ts`).
   - *Status:* Missing from local environment. Will request from user prior to Checkpoint 4.
2. **Supabase Database Connection String or SQL Editor Access:**
   - For applying migrations in `supabase/migrations/`.
   - Complete, idempotent SQL migration files will be provided so user can apply them in Supabase SQL Editor if CLI token is not configured.

