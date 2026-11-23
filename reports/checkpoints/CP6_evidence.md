# Checkpoint 6 Evidence: Frontend Foundation

**Date:** November 17, 2026  
**Checkpoint:** Checkpoint 6 (Frontend Foundation)  
**Status:** **PASS**

---

## 1. Foundation Components Created
- **Framework:** React 19 + Vite 6 + TypeScript 5.7.
- **Styling:** Tailwind CSS 4 with custom restrained palette:
  - Canvas background: `#FAF8F5` (warm off-white)
  - Typography: `#1A1A1A` (near-black)
  - Muted red accent: `#C8102E` (TED red)
  - Borders: `#E5E2DC` (warm grey)
  - Modest border radii, zero purple/neon/glow aesthetics.
- **Client Configuration:**
  - `frontend/src/services/supabase.ts`: Supabase browser client with session persistence.
  - `frontend/src/services/api.ts`: Centralized Express API client with automatic JWT token attachment.
  - `frontend/src/context/AuthContext.tsx`: Full authentication context handling session lifecycle, OTP verification, Google OAuth, and profile caching.
- **UI Components:**
  - `Navbar.tsx`: Sticky responsive header with brand, navigation links, and user session pill.
  - `Footer.tsx`: Restrained footer with academic attribution and historical snapshot disclaimer.
  - `TalkCard.tsx`: Reusable talk card with typographic fallback thumbnail, TED red rule, favorite toggle, and external "Watch on TED" button.
  - `SkeletonCard.tsx`: Pulse loading state component.
  - `ProtectedRoute.tsx`: Route guard redirecting unauthenticated visitors to `/login`.

