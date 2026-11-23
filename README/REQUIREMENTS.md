# System Requirements & Specifications: TalkWise

This document specifies the technical, functional, and behavioral requirements for TalkWise.

---

## 1. Functional Requirements

### 1.1 Authentication & User Management
- **FR-AUTH-1 (Registration):** Users can register with email and password. Email confirmation via 8-digit OTP is enforced via Brevo SMTP integration.
- **FR-AUTH-2 (Username / Email Login):** Users can authenticate via `POST /api/auth/login` using either their case-insensitive username (`[a-z0-9_]`, 3–30 characters) or their email address. Generic error responses ("Invalid credentials") prevent account enumeration.
- **FR-AUTH-3 (Google OAuth):** Native Supabase Google OAuth provider integration with local and production redirect URI support.
- **FR-AUTH-4 (Password Management):** Password reset workflow using dedicated tokenized reset routes and secure password update endpoints.
- **FR-AUTH-5 (Profiles):** Automatically provisioned user profiles on sign-up (via PostgreSQL `SECURITY DEFINER` trigger) storing username, full name, avatar URL, bio, and onboarding state.

### 1.2 Catalog Browsing & Search
- **FR-CAT-1 (Catalog Display):** Paginated browse view of TED Talks with responsive grid layout and skeleton loaders.
- **FR-CAT-2 (Search):** Debounced full-text search across talk titles, speaker names, and descriptions.
- **FR-CAT-3 (Filtering & Sorting):** Tag-based filtering and multi-criteria sorting (Popularity / Views, Newest Date, Title A–Z, Duration).
- **FR-CAT-4 (Canonical Slug Navigation):** All talk detail routes use the normalized URL slug (`/talks/:slug`).

### 1.3 Talk Details & TED Outbound Action
- **FR-DET-1 (Talk Detail View):** Full talk metadata display including title, speaker, description, tags, film date, event, duration, and snapshot view count.
- **FR-DET-2 (Watch on TED):** A dedicated "Watch on TED" button opens the official `ted.com` talk URL in a new tab (`rel="noopener noreferrer"`).
- **FR-DET-3 (Activity Logging):** Outbound click logs an asynchronous `ted_click` event without blocking user navigation.
- **FR-DET-4 (Similar Talks):** Content-based and collaborative neighbor talks displayed on the talk details page.

### 1.4 Recommendations & Personalization
- **FR-REC-1 (Personalized Recommendations):** Generates top-$K$ recommendations based on user favorites history using the hybrid recommendation pipeline.
- **FR-REC-2 (Transparent Explanations):** Each recommended talk provides a contextual "why" explanation (e.g. shared tags, similarity to a specific favorited talk) and an honest source indicator (`personalized`, `cold_start`, or `popularity_fallback`).
- **FR-REC-3 (User Onboarding Cold-Start):** First-time login onboarding flow capturing preferred topics/tags, stored in `user_preferences`.
- **FR-REC-4 (Favorites Management):** Optimistic favorite/unfavorite toggle with database persistence and rollback on network failure.
- **FR-REC-5 (Fallback Behavior):** If the ML service is unreachable, the Express API gracefully falls back to popular/diverse catalog recommendations without service degradation.

---

## 2. Technical & Non-Functional Requirements

### 2.1 Cross-System Canonical Talk Key
- The primary cross-system identifier across CSVs, JSON data, the PostgreSQL database, and ML vector artifacts is the **normalized URL slug**:
  - Lowercase, trailing whitespace and newlines stripped.
  - Protocol (`http://`, `https://`) and host (`www.ted.com`, `ted.com`) removed.
  - Path prefix `/talks/` stripped.
  - Trailing `.html`, URL query parameters, and trailing slashes removed.
  - Example: `ken_robinson_says_schools_kill_creativity`.
- The database `talks` table maintains a `bigint identity` primary key for database relations, but all external queries and ML calls use `slug`.

### 2.2 Security Requirements
- **NFR-SEC-1 (Row Level Security):** All Supabase tables (`profiles`, `favorites`, `user_activity`, `user_preferences`) enforce RLS policies isolating user records (`auth.uid() = user_id`).
- **NFR-SEC-2 (Service Isolation):** Internal ML FastAPI microservice is isolated behind an `X-Internal-Key` shared secret header and never exposed publicly.
- **NFR-SEC-3 (Rate Limiting):** Strict request rate limiting on authentication routes to mitigate brute-force and credential-stuffing attacks.
- **NFR-SEC-4 (Secret Hygiene):** Service-role keys and database passwords are never exposed to the frontend or committed to git.

### 2.3 Performance & Reliability
- **NFR-PERF-1 (Memory Footprint):** ML model artifacts utilize compact sparse neighbor tables and factor matrices (< 2 MB) to run comfortably within free-tier container memory limits (512 MB RAM).
- **NFR-PERF-2 (Inference Latency):** Recommendation generation latency under 50ms for real-time user requests.
- **NFR-PERF-3 (Idempotent Migrations & Seeding):** All database setup scripts and seeding procedures are strictly idempotent.

