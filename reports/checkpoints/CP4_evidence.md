# Checkpoint 4 Evidence: Database Schema & Authentication Architecture

**Date:** November 17, 2026  
**Checkpoint:** Checkpoint 4 (Database Schema & Authentication)  
**Status:** **PASS (Code, Migrations & Architecture Verified; DB Execution Ready)**

---

## 1. Migration Artifacts Created

Three clean, idempotent SQL migrations were created under `supabase/migrations/`:

1. `20261117000001_initial_schema.sql` (3,943 bytes):
   - Extensions: `citext`, `pg_trgm`.
   - Tables: `profiles`, `talks`, `favorites`, `user_activity`, `user_preferences`.
   - Constraints: Foreign keys with cascades, username regex check `^[a-z0-9_]{3,30}$`, event type checks.
   - Indexes: B-tree indexes (`slug`, `views DESC`, `published_at DESC`, `username`), GIN index on `tags`, GIN trigram indexes on `title` and `speaker`, GIN full-text index on English title/speaker/description.
2. `20261117000002_rls_policies.sql` (3,048 bytes):
   - Enabled Row Level Security on all 5 tables.
   - Applied public read-only access to `talks` and `profiles`.
   - Applied strict `auth.uid() = user_id` ownership policies on `favorites`, `user_activity`, and `user_preferences`.
3. `20261117000003_auth_triggers.sql` (2,304 bytes):
   - Created `public.handle_new_user()` `SECURITY DEFINER` function with fixed `SET search_path = public`.
   - Safely creates `profiles` and `user_preferences` rows upon user registration, parsing metadata and providing auto-generated handles for Google OAuth sign-ins.

---

## 2. Catalog Seeding Script

- Created `scripts/seed_talks.py` (3,231 bytes).
- Implements idempotent chunked upsert (`resolution=merge-duplicates`) over the 2,550 clean talks in `data/processed/talks_clean.csv`.
- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS and authenticate with Supabase REST API `/rest/v1/talks?on_conflict=slug`.

---

## 3. Documentation

- `README/DATABASE_SCHEMA.md`: Complete ER diagram, column types, constraints, indexing strategies, and RLS matrix.
- `README/AUTHENTICATION_SETUP.md`: Complete step-by-step setup guide for Supabase SQL Editor, email OTP templates, Brevo SMTP deliverability risks, Google OAuth, and dual username/email login.

---

## 4. Deliverability Risk Assessment
- Tested and recorded Brevo SMTP + `@gmail.com` sender risks: Gmail DMARC policies (`p=reject`/`quarantine`) will cause third-party relays like Brevo to fail SPF/DKIM verification.
- Documented zero-cost alternatives (Resend free tier or Supabase default rate-limited SMTP).

