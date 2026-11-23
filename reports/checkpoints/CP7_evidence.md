# Checkpoint 7 Evidence: Functional Website

**Date:** November 17, 2026  
**Checkpoint:** Checkpoint 7 (Functional Website)  
**Status:** **PASS**

---

## 1. Views & Pages Implemented
- `LandingPage.tsx`: Hero section, search input, featured talks grid, recommendation system architecture breakdown.
- `DashboardPage.tsx`: Personalized recommendation feed with "why recommended" badges, trending talks feed, and automated fallback alert banner.
- `BrowsePage.tsx`: Full catalog search with input debouncing, horizontal tag filter chips, sorting (most viewed, published date, title), and pagination controls.
- `TalkDetailPage.tsx`: Deep-dive talk page showing metadata, tags, speaker occupation, duration, external "Watch on TED" button logging non-blocking `ted_click` activity, favorite toggle, and related talks grid.
- `ProfilePage.tsx`: Saved favorites library with one-click unfavorite, and chronological user activity history.
- `OnboardingModal.tsx`: Topic curation modal for cold-start users selecting 3+ topics to calibrate initial recommendations.
- `LoginPage.tsx`: Dual username or email login, password entry, Google OAuth integration, links to register and password recovery.
- `RegisterPage.tsx`: User registration form validating username format `^[a-z0-9_]{3,30}$`.
- `VerifyEmailPage.tsx`: 8-digit numeric OTP code verification screen.
- `ForgotPasswordPage.tsx`: Password recovery request screen.
- `AboutPage.tsx`: Mission statement, dataset licensing documentation (CC-BY-NC 3.0 & 4.0), ML methodology explanation, and tech stack details.

---

## 2. Interaction Verification
- **Card Click Behavior:** Navigates directly to internal `/talks/:slug` route.
- **External Watch:** "Watch on TED" button opens `ted.com` in a new tab (`rel="noopener noreferrer"`) and dispatches a background `ted_click` event without blocking navigation.
- **Zero Mock Data:** All data rendered originates from PostgreSQL catalog or ML microservice endpoints.

