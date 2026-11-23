# System Architecture: TalkWise

This document details the architectural layout, component interactions, and data flows of TalkWise.

---

## 1. System Topology & Component Diagram

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Browser)"]
        UI["React SPA (Vite + TypeScript + Tailwind)"]
        SupaClient["@supabase/supabase-js (Client Auth)"]
    end

    subgraph API_Gateway ["Application Backend (Node Express)"]
        Express["Express REST API (TypeScript)"]
        AuthMiddleware["JWT Verification & RLS Proxy"]
        RateLimiter["express-rate-limit"]
        FallbackEngine["Database Popularity Fallback"]
    end

    subgraph ML_Microservice ["Recommendation Service (Python FastAPI)"]
        FastAPI["FastAPI App (uvicorn)"]
        InternalAuth["X-Internal-Key Auth Guard"]
        HybridEngine["Hybrid Scoring Engine"]
        CF_Model["NumPy/SciPy iALS & Item-Item CF"]
        Content_Model["TF-IDF Cosine Similarity"]
        Artifacts[("Compact ML Artifacts (.npz / .joblib)")]
    end

    subgraph Data_Layer ["Data & Identity (Supabase Platform)"]
        SupaAuth["Supabase Auth (GoTrue + Brevo SMTP)"]
        Postgres[("PostgreSQL Database (RLS Enforced)")]
    end

    %% Client Interactions
    UI -->|"User Actions / Navigation"| SupaClient
    SupaClient -->|"Auth Flow (OTP, OAuth, JWT)"| SupaAuth
    UI -->|"REST API Calls (Bearer JWT)"| Express

    %% Express Backend Interactions
    Express -->|"Authenticate Request"| AuthMiddleware
    AuthMiddleware -->|"Scoped Database Queries (User Context)"| Postgres
    Express -->|"Fetch /recommend, /similar (X-Internal-Key)"| FastAPI
    Express -.->|"On ML Failure"| FallbackEngine
    FallbackEngine -->|"Query Cached Popular Talks"| Postgres

    %% ML Service Interactions
    FastAPI -->|"Verify Secret"| InternalAuth
    InternalAuth -->|"Compute Scores"| HybridEngine
    HybridEngine -->|"Fold-in User History"| CF_Model
    HybridEngine -->|"Content Vectors & Centroids"| Content_Model
    CF_Model --> Artifacts
    Content_Model --> Artifacts
```

---

## 2. Component Breakdown

### 2.1 Frontend Layer (`/frontend`)
- **Technology:** React 19 / Vite / TypeScript / Tailwind CSS / React Router.
- **State Management:** Lightweight React Contexts (`AuthContext`, `ToastContext`).
- **Auth Management:** Browser-safe `@supabase/supabase-js` using publishable key (`sb_publishable_...`).
- **Design Tokens:** Warm off-white background (`#FAF8F5`), charcoal text (`#1A1A1A`), TED-toned red accent (`#C8102E`), light grey borders (`#E5E2DC`), 4–6px border radii.

### 2.2 Backend Gateway (`/backend`)
- **Technology:** Express / TypeScript / Zod / Helmet / Morgan / Express-Rate-Limit.
- **Role:** Central application gateway orchestrating talk queries, user activity tracking, favorite toggling, profile resolution, and proxying recommendations.
- **Security:** Verifies Supabase Bearer JWT tokens. Passes user token to Supabase client so PostgreSQL Row Level Security (RLS) policies are respected.
- **Failover:** In the event that the Python ML service is starting up, cold-booting, or temporarily unavailable, Express gracefully catches the HTTP error and returns top popular and diverse talks from PostgreSQL, flagging `source: "popularity_fallback"`.

### 2.3 ML Recommendation Microservice (`/ml/service`)
- **Technology:** Python 3.13 / FastAPI / Uvicorn / Pydantic / NumPy / SciPy / Scikit-Learn.
- **Role:** Pure stateless recommendation engine.
- **Endpoints:**
  - `GET /health`: Healthcheck, uptime, loaded model versions.
  - `POST /recommend`: Accepts user favorited slugs, optional topic preferences, and generates top-$K$ recommendations with honest explanations.
  - `GET /similar/{slug}`: Returns top content and collaborative neighbors for a specific talk.
  - `GET /popular`: Returns global baseline talk rankings.
- **Security:** Requires `X-Internal-Key` header matching the backend secret.

### 2.4 Persistence & Identity Layer (Supabase)
- **PostgreSQL 15+:** Hosts relational schema with RLS on all user tables.
- **GoTrue Auth:** Handles sign-ups, email OTP verification via Brevo SMTP, password resets, and Google OAuth.
- **Triggers:** Automatically initializes user profiles on auth user creation.

---

## 3. Core Data Flows

### 3.1 Recommendation Generation Flow
```
User navigates to Dashboard
       │
       ▼
Frontend requests GET /api/recommendations (Authorization: Bearer <jwt>)
       │
       ▼
Express validates JWT and extracts user_id
       │
       ├─► Queries Supabase: Fetch user's favorited talk slugs & onboarding preferences
       │
       ▼
Express calls ML Service: POST /recommend (X-Internal-Key: <secret>)
       │  Body: { favorite_slugs: [...], preferred_tags: [...], k: 10 }
       │
       ▼
FastAPI computes hybrid scores:
       ├─► Item-Item CF & iALS fold-in on favorite slugs
       ├─► TF-IDF user profile vector & cosine similarity
       ├─► Adaptive weighted score blend with cold-start fallback
       ▼
Returns ranked slugs with explanations to Express
       │
       ▼
Express hydrates talk slugs with full metadata from database
       │
       ▼
Returns rich recommendation payload to Frontend with source: "personalized"
```

