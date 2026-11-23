# TalkWise Local Development Setup Guide

This guide walks you through running all three tiers of TalkWise locally:
1. **Python ML Microservice** (Port 8000)
2. **Node.js Express REST API** (Port 5000)
3. **React 19 Vite Frontend** (Port 5173)

---

## 1. Prerequisites

- **Python:** 3.11, 3.12, 3.13, or 3.14 (64-bit)
- **Node.js:** v20.x or newer (tested on v26.10.0)
- **Package Manager:** npm or pnpm
- **Supabase Account:** Free tier project configured with TalkWise migrations

---

## 2. Setting Up the Python ML Microservice

1. **Activate Virtual Environment:**
   ```powershell
   # Windows PowerShell
   .venv\Scripts\Activate.ps1
   ```

2. **Install ML Dependencies (if not already installed):**
   ```powershell
   pip install -r ml/requirements.txt
   ```

3. **Verify ML Tests:**
   ```powershell
   python -m unittest discover ml/tests -v
   ```
   *Expected output: Ran 49 tests ... OK*

4. **Start the ML Service:**
   ```powershell
   $env:PYTHONPATH="ml/src;."
   uvicorn ml.service.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *Health check:* Visit `http://127.0.0.1:8000/health` in your browser.

---

## 3. Setting Up the Express Backend API

1. **Navigate to Backend Directory:**
   ```powershell
   cd backend
   ```

2. **Install Node Dependencies:**
   ```powershell
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```powershell
   cp .env.example .env
   ```
   Ensure `.env` contains:
   ```ini
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   SUPABASE_URL=https://lnrhliamfervhrbxzaxj.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_GMBnZypQwL7IGrs_JI0KWQ_SmjVBeY_
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ML_SERVICE_URL=http://127.0.0.1:8000
   ML_INTERNAL_KEY=4yr1FDncao9YNu1npB1CfEqDRw2B2q1LZoxpg1jspuA
   ```

4. **Start Express in Development Mode:**
   ```powershell
   npm run dev
   ```
   *Health check:* Visit `http://localhost:5000/api/health`.

---

## 4. Setting Up the React Frontend

1. **Navigate to Frontend Directory:**
   ```powershell
   cd ../frontend
   ```

2. **Install Frontend Dependencies:**
   ```powershell
   npm install
   ```

3. **Configure Frontend Environment:**
   Copy `.env.example` to `.env`:
   ```powershell
   cp .env.example .env
   ```
   Ensure `.env` contains:
   ```ini
   VITE_SUPABASE_URL=https://lnrhliamfervhrbxzaxj.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_GMBnZypQwL7IGrs_JI0KWQ_SmjVBeY_
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Start Vite Development Server:**
   ```powershell
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 5. End-to-End Workflow Verification

1. **Browse Talks:** Navigate to `/browse` and search for "creativity" or filter by "Technology".
2. **View Talk Details:** Click on any talk card to view its metadata. Click "Watch on TED" to verify external opening.
3. **Register / Sign In:** Create an account at `/register` or sign in at `/login`.
4. **Onboarding:** Select 3+ topics in the onboarding modal to calibrate initial cold-start recommendations.
5. **Personalize:** Click the heart icon on any talk to save it. Refresh your `/dashboard` to observe personalized recommendations derived from your favorites!

