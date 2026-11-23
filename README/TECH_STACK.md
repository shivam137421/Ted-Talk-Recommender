# Technology Stack & Decision Matrix: TalkWise

This document documents the selected technology stack, version pins, and technical justifications.

---

## 1. Selected Stack Summary

| Layer | Primary Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React / Vite | React 19, Vite 6 | Fast single-page application build & client-side routing |
| **Frontend Language** | TypeScript | ^5.6.0 | Strict type safety across client interfaces |
| **Styling & Design** | Tailwind CSS | ^3.4.0 / ^4.0 | Utility-first responsive styling with restrained design tokens |
| **Icons** | Lucide React | ^0.460.0 | Lightweight, consistent SVG icon set |
| **Client Auth** | `@supabase/supabase-js` | ^2.46.0 | GoTrue auth client & session management |
| **Backend API** | Node.js / Express | Node v22+ LTS, Express ^4.21 | RESTful application API gateway & security layer |
| **Backend Language** | TypeScript | ^5.6.0 | Type safety matching frontend contracts |
| **Validation** | Zod | ^3.23.0 | Schema validation for all HTTP payloads |
| **Security & Utilities** | Helmet, CORS, Rate-Limit | Industry standard | Security headers, origin locking, brute-force mitigation |
| **ML Microservice** | Python / FastAPI | Python 3.13.6, FastAPI, Uvicorn | High-performance async recommendation inference service |
| **ML Engine** | NumPy, SciPy, Scikit-Learn | NumPy 2.5, SciPy 1.18, Sklearn 1.9 | TF-IDF vectorization, sparse CSR matrices, iALS, BPR, Cosine CF |
| **Database & Auth** | Supabase (PostgreSQL) | Postgres 15+ | Relational data persistence with Row Level Security |
| **Email SMTP** | Brevo SMTP via Supabase | Port 587 | Transactional email delivery for 8-digit OTP confirmation |

---

## 2. Technical Decisions & Justifications

### 2.1 Python Collaborative Filtering Engine (NumPy / SciPy vs `implicit`)
- **Evaluation:** The C++ Cython library `implicit` lacks pre-built wheels for Python 3.13 on Windows, triggering compilation failures requiring Microsoft Visual C++ Build Tools.
- **Decision:** Implement **Item-based CF, Implicit ALS (iALS), and BPR directly using pure NumPy and SciPy**.
- **Justification:**
  1. **Zero C++ compilation friction:** Guaranteed installation and execution across Windows, macOS, Linux, and Alpine Docker containers.
  2. **Predictable memory footprint:** Complete control over sparse CSR matrices and truncated neighbor lists.
  3. **Exact fold-in implementation:** Direct closed-form computation for arbitrary user histories at request time without retraining the entire user factor matrix.

### 2.2 Express + FastAPI Decoupled Microservice Architecture
- **Evaluation:** Running Python recommendation scripts inside Node via `child_process.exec()` vs HTTP service.
- **Decision:** Dedicated FastAPI service called via HTTP with an internal shared key (`X-Internal-Key`).
- **Justification:**
  1. Subprocess spawning causes heavy Python interpreter startup latency (300–600ms per request).
  2. FastAPI keeps pre-fitted sparse matrices, vectorizers, and neighbor indices hot in RAM for < 50ms inference.
  3. Express handles authentication, database connections, and business logic, providing an automatic popularity fallback if the ML service is down or cold-booting.

### 2.3 Single Source of Truth for Talk Metadata
- ML artifacts store **only vectors, factors, truncated neighbor lists, and slug identifiers**.
- Talk titles, descriptions, speaker bios, and view counts are stored and queried exclusively from the Supabase `talks` table.
- Eliminates duplicate text storage and synchronizes display metadata automatically.

