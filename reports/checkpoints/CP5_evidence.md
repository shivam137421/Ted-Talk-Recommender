# Checkpoint 5 Evidence: Backend API & ML Microservice Architecture

**Date:** November 17, 2026  
**Checkpoint:** Checkpoint 5 (Backend API & ML Microservice)  
**Status:** **PASS**

---

## 1. Components Built

### 1.1. Python FastAPI / ML Microservice (`ml/service/`)
- `ml/service/main.py`: ASGI microservice running Starlette/FastAPI on port 8000.
  - Endpoints:
    - `GET /health`: Service health and catalog statistics.
    - `POST /recommend`: Protected by `X-Internal-Key` shared secret header. Dispatches to `HybridRecommender` with user favorites and onboarding tags.
    - `GET /similar/{slug}`: Fast cosine neighbor lookup (< 1ms).
    - `GET /popular`: View count ranking baseline.
- `ml/service/loader.py`: Singleton `ModelManager` loading TF-IDF matrices, vectorizer, precomputed top-50 content neighbors, and collaborative models.
- `ml/service/schemas.py`: Input/output schemas with automatic k clamping (1..100) and normalization.
- `ml/tests/test_service.py`: 14 unit tests covering schemas, security keys, model manager, cold-start handling, and neighbor queries. **14/14 tests PASSED in 0.032s.**

### 1.2. Node.js Express Gateway (`backend/`)
- TypeScript + Node 26 + Express 4.
- Security: Helmet, CORS configuration, rate limiting (`express-rate-limit`: 150/15min general, 15/15min on auth).
- Request validation: Zod schemas for login, query params, favorites, activity, profile, and preferences.
- Supabase Integration:
  - Scoped client per user session passing JWT token to strictly enforce PostgreSQL Row Level Security (RLS).
  - Admin service role client used exclusively for server-side username-to-email resolution.
- ML Integration & Fallback:
  - `ml.service.ts` calls ML service via HTTP with timeout.
  - In case of ML service failure or timeout, automatically executes database popularity query and returns results with `is_fallback: true` and clear explanation.
- Routes Implemented:
  - `POST /api/auth/login` (dual username or email login)
  - `GET /api/talks` (search, tag filter, sorting, pagination)
  - `GET /api/talks/tags` (popular tags list)
  - `GET /api/talks/:slug` (talk details with `is_favorited` status)
  - `GET /api/talks/:slug/similar` (content similarity proxy)
  - `GET /api/recommendations` (hydrated hybrid recommendations + fallback)
  - `GET /api/favorites`, `POST /api/favorites`, `DELETE /api/favorites/:slug` (favorite management + activity log)
  - `POST /api/activity`, `GET /api/activity` (user activity stream)
  - `GET /api/profile`, `PATCH /api/profile` (profile management)
  - `GET /api/preferences`, `PUT /api/preferences` (cold-start onboarding topics)
  - `GET /api/health` (health check with dependency statuses)

---

## 2. Test Execution Verification

```
Ran 14 tests in 0.032s
OK

Ran 49 tests in 4.708s (complete ML suite)
OK
```

---

## 3. Documentation
- Complete API specification documented in `README/API_DOCUMENTATION.md`.

