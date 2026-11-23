export interface Talk {
  id: number;
  slug: string;
  title: string;
  speaker: string;
  speaker_occupation?: string;
  description: string;
  tags: string[];
  views: number;
  duration_seconds: number;
  published_at?: string;
  film_date?: string;
  event?: string;
  ted_url: string;
  thumbnail_url?: string | null;
  has_transcript?: boolean;
  has_interactions?: boolean;
  is_favorited?: boolean;
  score?: number;
  source?: string;
  explanation?: string;
  is_fallback?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  preferred_tags: string[];
  onboarding_completed: boolean;
  settings?: Record<string, any>;
}

export interface ActivityEvent {
  id: number;
  event_type: "view" | "ted_click" | "search" | "favorite" | "unfavorite";
  created_at: string;
  metadata?: Record<string, any>;
  talks?: {
    slug: string;
    title: string;
    speaker: string;
  };
}

