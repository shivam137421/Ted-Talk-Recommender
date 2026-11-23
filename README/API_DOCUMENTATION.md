# TalkWise API Documentation

TalkWise employs a dual-tier microservice architecture:
1. **Node.js Express Gateway (`/api/*` on port 5000):** Public REST API handling authentication, request validation (Zod), rate limiting, PostgreSQL database operations via Supabase RLS, and automatic popularity fallback.
2. **Python FastAPI / Starlette ML Microservice (`port 8000`):** Internal compute engine running hybrid matrix scoring, TF-IDF cosine similarity, item-item collaborative fold-in, and signal-derived explanation generation, secured by shared header `X-Internal-Key`.

---

## 1. Authentication & Security

### Client Authentication
Protected endpoints require a valid Supabase JWT Bearer token in the HTTP Authorization header:
```http
Authorization: Bearer <supabase_access_token>
```

### Internal Microservice Authentication
All calls between the Express gateway and the Python ML service are authenticated with the shared secret key:
```http
X-Internal-Key: <ML_INTERNAL_KEY>
```

---

## 2. Express Gateway API Endpoints

### 2.1. Authentication: `POST /api/auth/login`
Authenticates a user via dual identifier (email or unique username). Rate limited to 15 attempts / 15 min.

- **Request Body:**
  ```json
  {
    "identifier": "shivam",
    "password": "user_password_123"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "message": "Login successful",
    "session": {
      "access_token": "eyJhbGciOi...",
      "refresh_token": "...",
      "expires_at": 1731873600
    },
    "user": {
      "id": "e2c34d56-...",
      "email": "shivam@example.com",
      "profile": {
        "id": "e2c34d56-...",
        "username": "shivam",
        "full_name": "Shivam Yadav",
        "avatar_url": null,
        "bio": ""
      }
    }
  }
  ```
- **Error `401 Unauthorized`:**
  ```json
  {
    "error": "Error",
    "message": "Invalid credentials"
  }
  ```

---

### 2.2. Talks Catalog: `GET /api/talks`
Searches, filters by topic tag, sorts, and paginates the 2,550 talk catalog.

- **Query Parameters:**
  - `page` (integer, default `1`)
  - `limit` (integer, default `20`, max `100`)
  - `q` (string, optional, full-text / trigram search query)
  - `tag` (string, optional, topic filter)
  - `sort` (enum: `views`, `published_at`, `title`, `duration_seconds`, default `views`)
  - `order` (enum: `asc`, `desc`, default `desc`)

- **Response `200 OK`:**
  ```json
  {
    "talks": [
      {
        "id": 1,
        "slug": "ken_robinson_says_schools_kill_creativity",
        "title": "Do schools kill creativity?",
        "speaker": "Ken Robinson",
        "speaker_occupation": "Author/educator",
        "description": "Sir Ken Robinson makes an entertaining and profoundly moving case...",
        "tags": ["children", "creativity", "culture", "dance", "education", "parenting", "teaching"],
        "views": 47227110,
        "duration_seconds": 1164,
        "published_at": "2006-06-27T00:11:00Z",
        "ted_url": "https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity"
      }
    ],
    "pagination": {
      "total": 2550,
      "page": 1,
      "limit": 20,
      "totalPages": 128,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

---

### 2.3. Single Talk Details: `GET /api/talks/:slug`
Retrieves full talk metadata. If authenticated, includes `is_favorited: true/false`.

- **Response `200 OK`:**
  ```json
  {
    "talk": {
      "id": 1,
      "slug": "ken_robinson_says_schools_kill_creativity",
      "title": "Do schools kill creativity?",
      "speaker": "Ken Robinson",
      "speaker_occupation": "Author/educator",
      "description": "...",
      "tags": ["children", "creativity", "education"],
      "views": 47227110,
      "duration_seconds": 1164,
      "published_at": "2006-06-27T00:11:00Z",
      "ted_url": "https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity",
      "has_transcript": true,
      "has_interactions": true,
      "is_favorited": true
    }
  }
  ```
- **Error `404 Not Found`:** If slug does not exist in catalog.

---

### 2.4. Recommendations: `GET /api/recommendations`
Generates personalized hybrid recommendations for authenticated users or cold-start recommendations for guests.

- **Query Parameters:**
  - `k` (integer, default `10`, max `30`)
  - `tags` (comma-separated string, optional for guests)

- **Response `200 OK`:**
  ```json
  {
    "recommendations": [
      {
        "id": 84,
        "slug": "sir_ken_robinson_bring_on_the_revolution",
        "title": "Bring on the learning revolution!",
        "speaker": "Ken Robinson",
        "tags": ["children", "creativity", "education"],
        "views": 7271821,
        "score": 0.4263,
        "source": "personalized",
        "explanation": "Similar to 'Do schools kill creativity?' (topics: children, creativity)",
        "is_fallback": false
      }
    ],
    "count": 1,
    "model_strategy": "hybrid",
    "is_fallback": false,
    "fallback_reason": null
  }
  ```
- **Automatic Fallback:**
  If the ML service is down or unreachable, Express returns top talks by views from the PostgreSQL database with:
  ```json
  {
    "is_fallback": true,
    "fallback_reason": "ML recommendation service unavailable; displaying most popular talks snapshot."
  }
  ```

---

### 2.5. User Favorites: `GET`, `POST`, `DELETE /api/favorites`
Manage positive implicit signals used to seed collaborative filtering. Requires authentication.

- **`GET /api/favorites`:** Lists all user favorited talks ordered by favorited timestamp descending.
- **`POST /api/favorites`:**
  - **Body:** `{ "slug": "ken_robinson_says_schools_kill_creativity" }`
  - Adds favorite and automatically logs `"favorite"` activity event.
- **`DELETE /api/favorites/:slug`:**
  - Removes favorite and logs `"unfavorite"` activity event.

---

### 2.6. User Activity: `POST`, `GET /api/activity`
Auditable interaction stream tracking engagement. Requires authentication.

- **`POST /api/activity`:**
  - **Body:**
    ```json
    {
      "event_type": "ted_click",
      "slug": "ken_robinson_says_schools_kill_creativity",
      "metadata": { "dwell_time": 45 }
    }
    ```
- **`GET /api/activity`:**
  - Returns last 50 activities for user.

---

### 2.7. Profile & Preferences: `GET`, `PATCH /api/profile` & `GET`, `PUT /api/preferences`
Retrieves or updates user details and cold-start onboarding topic preferences. Requires authentication.

---

### 2.8. Health Status: `GET /api/health`
Returns health of Express gateway and connectivity to Supabase and ML microservice.

- **Response `200 OK`:**
  ```json
  {
    "status": "healthy",
    "service": "talkwise-backend",
    "version": "1.0.0",
    "timestamp": "2026-11-17T15:15:00.000Z",
    "uptime_seconds": 1240,
    "dependencies": {
      "database": "connected",
      "ml_service": "connected"
    }
  }
  ```

---

## 3. Python FastAPI / ML Microservice Endpoints

### 3.1. Health Check: `GET /health`
- **Response `200 OK`:**
  ```json
  {
    "status": "healthy",
    "service": "talkwise-ml",
    "version": "1.0.0",
    "catalog_size": 2550,
    "models_loaded": true
  }
  ```

### 3.2. Recommendations: `POST /recommend`
Protected by `X-Internal-Key` header.
- **Request Body:**
  ```json
  {
    "favorite_slugs": ["ken_robinson_says_schools_kill_creativity"],
    "preferred_tags": ["education", "creativity"],
    "k": 10,
    "exclude_slugs": ["ken_robinson_says_schools_kill_creativity"],
    "include_favorites": false
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "recommendations": [
      {
        "slug": "sir_ken_robinson_bring_on_the_revolution",
        "score": 0.4263,
        "source": "personalized",
        "explanation": "Similar to 'Do schools kill creativity?' (topics: children, creativity)"
      }
    ],
    "count": 1,
    "model_strategy": "hybrid"
  }
  ```

### 3.3. Similar Talks: `GET /similar/{slug}?k=10`
Returns top-k precomputed cosine neighbors from TF-IDF space (< 1ms).

### 3.4. Popular Talks: `GET /popular?k=10`
Returns top-k talks by historical view count.

