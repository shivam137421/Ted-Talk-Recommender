-- Migration: 20261117000003_auth_triggers.sql
-- Description: Automated profile and preference initialization on auth.users registration
-- Rollback: DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; DROP FUNCTION IF EXISTS public.handle_new_user();

-- Trigger function with fixed search_path to prevent security definer hijacking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    candidate_username TEXT;
    full_name_val TEXT;
    avatar_url_val TEXT;
BEGIN
    -- 1. Extract metadata from raw_user_meta_data
    candidate_username := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'username', '')));
    full_name_val := TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
    avatar_url_val := TRIM(COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''));

    -- 2. Fallback for Google sign-in or missing username
    IF candidate_username IS NULL OR candidate_username = '' OR LENGTH(candidate_username) < 3 THEN
        candidate_username := 'user_' || SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 10);
    END IF;

    -- Ensure candidate username satisfies format constraint [a-z0-9_]{3,30}
    IF candidate_username !~ '^[a-z0-9_]{3,30}$' THEN
        candidate_username := 'user_' || SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 10);
    END IF;

    -- 3. Insert Profile
    INSERT INTO public.profiles (id, username, full_name, avatar_url, bio)
    VALUES (
        NEW.id,
        candidate_username,
        NULLIF(full_name_val, ''),
        NULLIF(avatar_url_val, ''),
        ''
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

    -- 4. Insert Default Preferences
    INSERT INTO public.user_preferences (user_id, preferred_tags, onboarding_completed)
    VALUES (NEW.id, '{}', FALSE)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

