-- Migration: 20261117000002_rls_policies.sql
-- Description: Row Level Security (RLS) policies isolating user records and protecting catalog integrity
-- Rollback: DISABLE RLS on all tables and drop policies

-- 1. Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 2. Talks Policies (Publicly readable, write-restricted to admin/service-role)
DROP POLICY IF EXISTS "Talks are publicly readable" ON public.talks;
CREATE POLICY "Talks are publicly readable"
    ON public.talks FOR SELECT
    USING (true);

-- 3. Profiles Policies (Read all public profiles, update own profile only)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4. Favorites Policies (Scoped strictly to authenticated user)
DROP POLICY IF EXISTS "Users view own favorites" ON public.favorites;
CREATE POLICY "Users view own favorites"
    ON public.favorites FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users add own favorites" ON public.favorites;
CREATE POLICY "Users add own favorites"
    ON public.favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own favorites" ON public.favorites;
CREATE POLICY "Users delete own favorites"
    ON public.favorites FOR DELETE
    USING (auth.uid() = user_id);

-- 5. User Activity Policies (Insert and select own, no updates or deletes)
DROP POLICY IF EXISTS "Users view own activity" ON public.user_activity;
CREATE POLICY "Users view own activity"
    ON public.user_activity FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own activity" ON public.user_activity;
CREATE POLICY "Users insert own activity"
    ON public.user_activity FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 6. User Preferences Policies (Full CRUD scoped strictly to self)
DROP POLICY IF EXISTS "Users view own preferences" ON public.user_preferences;
CREATE POLICY "Users view own preferences"
    ON public.user_preferences FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own preferences" ON public.user_preferences;
CREATE POLICY "Users insert own preferences"
    ON public.user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own preferences" ON public.user_preferences;
CREATE POLICY "Users update own preferences"
    ON public.user_preferences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

