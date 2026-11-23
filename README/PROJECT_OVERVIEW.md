# Project Overview: TalkWise

**TalkWise** is a full-stack, personalized TED Talks recommendation application engineered to help lifelong learners and curious minds discover relevant, high-impact talks from an expansive catalog of TED presentations.

---

## 1. The Core Problem

With thousands of TED Talks spanning technology, entertainment, design, science, psychology, humanities, and business, users face severe choice paralysis. While TED categorizes talks with tags and themes, standard keyword searches fail to capture:
- Latent semantic relationships across speeches and transcripts.
- Authentic user preference behavior and serendipitous discovery patterns.
- Personalized recommendations tailored to a user's evolving watch history.

---

## 2. The Solution

TalkWise delivers an end-to-end recommendation engine combining:
1. **Content-Based Filtering (NLP):** Natural Language Processing with TF-IDF vectorization across talk titles, descriptions, editorial tags, and complete human-made transcripts, measuring cosine similarity in semantic space.
2. **Collaborative Filtering (Implicit Feedback):** Latent factor modeling (iALS) and Item-Item neighborhood collaborative filtering trained on authentic user favorites extracted from public TED.com user profiles.
3. **Adaptive Hybrid Blending:** A dynamic scoring architecture that gracefully handles both the **user cold-start problem** (using onboarding topic preferences) and the **item cold-start problem** (falling back to content similarity for newer talks published after the collaborative filtering snapshot).
4. **Modern Web Experience:** A clean, responsive React frontend (Tailwind CSS) backed by an Express REST API, a dedicated Python FastAPI recommendation service, and Supabase for authentication and PostgreSQL data persistence.

---

## 3. High-Level System Workflow

```
[ User Interaction ] ──> [ React SPA Frontend ]
                                │
                                ▼ (HTTPS / Bearer JWT)
                     [ Express REST API Backend ]
                         │                 │
      (Talk Metadata & RLS)                ▼ (Internal HTTP / X-Internal-Key)
                         ▼             [ FastAPI ML Service ]
                 [ Supabase DB ]           │
             (PostgreSQL & Auth)           ▼ (In-Memory Latent Factors & Sparse Tables)
                                       [ Compact ML Artifacts ]
```

---

## 4. Key Non-Functional Goals

- **Zero Data Fabrication:** All recommendations, evaluations, user signals, and benchmark metrics reflect genuine mathematical models and real empirical datasets.
- **Academic Rigor:** Evaluated with Precision@K, Recall@K, MAP@K, and NDCG@K across multiple seeds with documented standard deviations.
- **Resource Efficiency:** Compact model artifacts (< 2 MB) designed to run within free-tier compute boundaries without memory spikes or expensive infrastructure.
- **Security & Privacy:** Row Level Security (RLS) on PostgreSQL, server-side secret isolation, rate limiting on authentication routes, and zero storage or leakage of user credentials.

