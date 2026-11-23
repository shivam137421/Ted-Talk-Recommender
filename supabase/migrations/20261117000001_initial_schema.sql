-- Migration: 20261117000001_initial_schema.sql
-- Description: Core tables, extensions, constraints, and indexes for TalkWise
-- Rollback: DROP TABLE IF EXISTS user_preferences, user_activity, favorites, talks, profiles CASCADE;

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Profiles Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username CITEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT username_format_check CHECK (username ~ '^[a-z0-9_]{3,30}$')
);

-- Index on profiles username
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 3. Talks Catalog Table
CREATE TABLE IF NOT EXISTS public.talks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    speaker TEXT NOT NULL,
    speaker_occupation TEXT,
    description TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    views BIGINT NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ,
    film_date TIMESTAMPTZ,
    event TEXT,
    ted_url TEXT NOT NULL,
    has_transcript BOOLEAN NOT NULL DEFAULT FALSE,
    has_interactions BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes on talks for fast filtering, sorting, and full-text search
CREATE INDEX IF NOT EXISTS idx_talks_slug ON public.talks(slug);
CREATE INDEX IF NOT EXISTS idx_talks_views ON public.talks(views DESC);
CREATE INDEX IF NOT EXISTS idx_talks_published_at ON public.talks(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_talks_tags ON public.talks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_talks_title_trgm ON public.talks USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_talks_speaker_trgm ON public.talks USING GIN(speaker gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_talks_search ON public.talks USING GIN(
    to_tsvector('english', title || ' ' || speaker || ' ' || COALESCE(description, ''))
);

-- 4. Favorites Table (User implicit/explicit positive signals)
CREATE TABLE IF NOT EXISTS public.favorites (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    talk_id BIGINT NOT NULL REFERENCES public.talks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, talk_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_talk ON public.favorites(talk_id);

-- 5. User Activity Table (Auditable event log)
CREATE TABLE IF NOT EXISTS public.user_activity (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    talk_id BIGINT REFERENCES public.talks(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'ted_click', 'search', 'favorite', 'unfavorite')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_date ON public.user_activity(user_id, created_at DESC);

-- 6. User Preferences Table (Cold-start topic preferences & settings)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    preferred_tags TEXT[] NOT NULL DEFAULT '{}',
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

