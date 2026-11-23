# Project Progress Tracker: TalkWise

**Current Branch:** `student/shivam137421`  
**Current Milestone:** Checkpoint 1 (Dataset Validation and Preprocessing)  
**Overall Status:** Active Development  

---

## Roadmap & Milestones

- [x] **Checkpoint 0: Inspection and Plan**
  - [x] Profile existing repository, Git history, and file size limits.
  - [x] Reproduce existing TF-IDF content-based recommender.
  - [x] Research hosting free-tier constraints (Vercel, Render, Supabase).
  - [x] Complete system architecture, requirements, and tech stack specs.
- [x] **Checkpoint 1: Dataset Validation and Preprocessing**
  - [x] Implement `ml/src/talkwise_ml/preprocessing/slug.py` and `cleaner.py`.
  - [x] Implement `ml/scripts/build_dataset.py`.
  - [x] Generate `data/processed/talks_clean.csv` and `data/processed/interactions.csv`.
  - [x] Write unit tests for slug normalization and preprocessing in `ml/tests/`.
  - [x] Generate `reports/data_validation.md` and `reports/checkpoints/CP1_evidence.md`.
- [x] **Checkpoint 2: Collaborative Filtering**
  - [x] Implement sparse CSR user-item matrix from implicit favorites.
  - [x] Implement Item-based CF, Implicit ALS (iALS), and BPR in NumPy/SciPy.
  - [x] Hyperparameter tuning on validation split.
  - [x] Save lightweight model artifacts (< 2 MB) under `ml/artifacts/collaborative/`.
  - [x] Implement `recommend_collaborative(favorite_slugs, k, exclude)` fold-in.
- [x] **Checkpoint 3: Hybrid Recommendation and Evaluation**
  - [x] Implement Content-based TF-IDF feature pipeline and user profile centroid.
  - [x] Build adaptive hybrid scorer with cold-start fallbacks.
  - [x] Execute rigorous evaluation script (`ml/scripts/evaluate.py`) across 5+ seeds.
  - [x] Generate Precision@K, Recall@K, MAP@K, NDCG@K for Random, Popularity, Content, CF, and Hybrid.
- [ ] **Checkpoint 4: Database and Authentication**
  - [ ] Author PostgreSQL migrations in `supabase/migrations/` (`profiles`, `talks`, `favorites`, `user_activity`, `user_preferences`).
  - [ ] Write RLS policies and triggers.
  - [ ] Write idempotent database seed script (`scripts/seed_talks.ts`).
  - [ ] Verify auth flows (OTP, username login, Google OAuth).
- [ ] **Checkpoint 5: Backend API (Express) & ML Service (FastAPI)**
  - [ ] Implement FastAPI microservice (`ml/service/`).
  - [ ] Implement Express REST API with TypeScript, Zod, and rate-limiting (`backend/`).
  - [ ] Implement automated fallback to database popularity on ML service outage.
  - [ ] Write integration and contract tests.
- [ ] **Checkpoint 6: Frontend Foundation**
  - [ ] Initialize Vite + React 19 + TypeScript + Tailwind CSS application (`frontend/`).
  - [ ] Configure design tokens, navbar, footer, talk cards, and skeleton loaders.
  - [ ] Set up Supabase auth context and protected routes.
- [ ] **Checkpoint 7: Functional Website**
  - [ ] Build Landing, About, Browse/Search, Talk Details, Profile, Dashboard pages.
  - [ ] Implement onboarding topic preferences for cold-start users.
  - [ ] Wire optimistic favorites and "Watch on TED" activity tracking.
- [ ] **Checkpoint 8: Integration Testing**
  - [ ] Implement Playwright end-to-end test suite (`frontend/e2e/`).
  - [ ] Run responsive layout checks and accessibility audit.
- [ ] **Checkpoint 9: Deployment Preparation**
  - [ ] Author Dockerfile and deployment guides for Vercel and Render.
- [ ] **Checkpoint 10: Final Verification and Documentation**
  - [ ] Full test pass across ML, backend, frontend, and e2e suites.
  - [ ] Update root `README.md` and verify zero secrets in repository.
