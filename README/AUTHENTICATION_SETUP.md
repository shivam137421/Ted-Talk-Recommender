# TalkWise Authentication & Supabase Setup Guide

This guide details the complete configuration required to operate Supabase Auth, PostgreSQL migrations, email OTP delivery via Brevo, Google OAuth, and the catalog seeding pipeline.

---

## 1. Supabase Project Information
- **Project URL:** `https://lnrhliamfervhrbxzaxj.supabase.co`
- **Project Ref:** `lnrhliamfervhrbxzaxj`
- **Public Anon / Publishable Key:** `sb_publishable_GMBnZypQwL7IGrs_JI0KWQ_SmjVBeY_`
- **Service Role Key:** Required in backend `.env` (never exposed to browser or frontend build).

---

## 2. Applying Database Migrations

Open your Supabase Project Dashboard at [supabase.com/dashboard/project/lnrhliamfervhrbxzaxj](https://supabase.com/dashboard/project/lnrhliamfervhrbxzaxj) and navigate to the **SQL Editor**.

Run the migration scripts in the following order:

### Step 1: Initial Schema
Copy and execute the entire contents of:
`supabase/migrations/20261117000001_initial_schema.sql`
- Enables `citext` and `pg_trgm` extensions.
- Creates `profiles`, `talks`, `favorites`, `user_activity`, and `user_preferences`.
- Creates B-tree, GIN array, and full-text search indexes.

### Step 2: Row Level Security Policies
Copy and execute the entire contents of:
`supabase/migrations/20261117000002_rls_policies.sql`
- Enables RLS on all 5 tables.
- Applies granular read/write policies isolating user records.

### Step 3: Auth Automation Triggers
Copy and execute the entire contents of:
`supabase/migrations/20261117000003_auth_triggers.sql`
- Installs `public.handle_new_user()` trigger on `auth.users`.
- Automatically initializes user profiles and default preferences upon sign-up (including Google OAuth sign-in).

---

## 3. Email Authentication & OTP Template

In the Supabase Dashboard, navigate to **Authentication** > **Providers** > **Email**:

1. Ensure **Enable Email provider** is turned **ON**.
2. **Confirm email** should be **ON**.
3. **Secure email change** should be **ON**.
4. Set **OTP expiry** to `3600` seconds (1 hour).

### Configuring the Email Confirmation Template:
Navigate to **Authentication** > **Email Templates** > **Confirm signup**:
- **Subject:** `Your TalkWise Verification Code`
- **Body:**
```html
<h2>Welcome to TalkWise!</h2>
<p>Enter the following verification code to confirm your account:</p>
<h1 style="font-size: 32px; letter-spacing: 4px; font-weight: bold; color: #C8102E;">{{ .Token }}</h1>
<p>This code will expire in 60 minutes.</p>
<p>If you did not sign up for TalkWise, you can safely ignore this email.</p>
```

Navigate to **Email Templates** > **Reset Password**:
- **Subject:** `Reset Your TalkWise Password`
- **Body:**
```html
<h2>TalkWise Password Reset</h2>
<p>Enter the following code to reset your password:</p>
<h1 style="font-size: 32px; letter-spacing: 4px; font-weight: bold; color: #C8102E;">{{ .Token }}</h1>
<p>This code will expire in 60 minutes.</p>
```

---

## 4. Brevo SMTP Configuration & Deliverability Analysis

To send custom transactional emails from your email account (`talkwise185@gmail.com`), configure custom SMTP in Supabase:

1. In Supabase Dashboard, go to **Project Settings** > **Authentication** > **SMTP Settings**.
2. Turn **Enable Custom SMTP** to **ON**.
3. Enter the following credentials:
   - **Sender email:** `talkwise185@gmail.com`
   - **Sender name:** `TalkWise Recommendations`
   - **Host:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Minimum TLS Version:** `TLS 1.2`
   - **User:** Your Brevo SMTP login
   - **Password:** Your Brevo SMTP Master Key

> [!WARNING]
> **Email Deliverability & Gmail DMARC Warning:**
> Sending from `@gmail.com` through a third-party relay (Brevo) will fail SPF/DKIM alignment because Google publishes a strict DMARC `p=reject` or `p=quarantine` policy for `@gmail.com` domains. Recipient mail servers (like Google, Yahoo, Outlook) will often reject or place these messages in spam.
>
> **Recommended Zero-Cost Solution:**
> 1. Use Resend's free tier (3,000 emails/month) with test domain `onboarding@resend.dev` for development.
> 2. Or, use Supabase's built-in default email rate limit (3 emails/hour for testing) without SMTP until a verified custom domain is attached.

---

## 5. Google OAuth 2.0 Configuration

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project (e.g. `TalkWise App`).
3. Configure the **OAuth consent screen**:
   - User Type: **External**
   - App name: `TalkWise`
   - User support email: `talkwise185@gmail.com`
   - Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
4. Under **Credentials**, click **Create Credentials** > **OAuth client ID**:
   - Application type: **Web application**
   - Name: `TalkWise Web Client`
   - **Authorized redirect URIs:**
     ```
     https://lnrhliamfervhrbxzaxj.supabase.co/auth/v1/callback
     ```
5. Copy the generated **Client ID** and **Client Secret**.
6. In Supabase Dashboard, go to **Authentication** > **Providers** > **Google**:
   - Turn **Google Enabled** to **ON**.
   - Paste **Client ID** and **Client Secret**.
   - Save changes.

---

## 6. Username / Email Dual Login Flow

Supabase Auth does not natively support logging in with an arbitrary username. TalkWise implements this securely via Express:

1. The client submits `POST /api/auth/login` with `{ "identifier": "shivam", "password": "..." }`.
2. The Express server determines if `identifier` contains `@`:
   - If `@` is present, it directly calls `supabase.auth.signInWithPassword({ email: identifier, password })`.
   - If no `@`, the server performs a server-side lookup on `public.profiles` using the privileged `service_role` key to find the corresponding user `id`.
   - Express queries `auth.users` via Supabase Admin API to retrieve the associated email.
   - Express then calls `signInWithPassword({ email, password })`.
3. If the user does not exist or the password is incorrect, Express returns a generic `401 Unauthorized` (`"Invalid credentials"`), preventing user enumeration attacks.
4. An IP-based rate limiter (10 attempts per 15 minutes) protects this endpoint against brute-force attacks.

---

## 7. Populating the Catalog (Seeding)

Once migrations are applied and the `SUPABASE_SERVICE_ROLE_KEY` is obtained:

1. Add your service role key to your local environment:
   ```powershell
   $env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
   ```
2. Run the seeding script:
   ```powershell
   .venv\Scripts\python.exe scripts\seed_talks.py
   ```
3. The script batches talks in chunks of 100 with `resolution=merge-duplicates`, idempotently upserting all 2,550 talks from `data/processed/talks_clean.csv`.

