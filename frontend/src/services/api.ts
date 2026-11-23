import { supabase } from "./supabase.js";
import { Talk, UserProfile, UserPreferences, ActivityEvent } from "../types/talk.js";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON body
    }
  }
  if (!res.ok) {
    const errorMsg =
      data?.message ||
      data?.error ||
      (res.status === 504 || res.status === 502
        ? "Backend service connection timed out or is unreachable."
        : `${fallbackMessage} (${res.status})`);
    throw new Error(errorMsg);
  }
  return data as T;
}

let cachedPopularTags: string[] | null = null;

export const api = {
  // Username Availability
  async checkUsername(username: string): Promise<{ available: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/check-username?username=${encodeURIComponent(username)}`);
      if (!res.ok) return { available: true };
      return res.json();
    } catch {
      return { available: true };
    }
  },

  // Talks Catalog
  async getTalks(params: {
    page?: number;
    limit?: number;
    q?: string;
    tag?: string;
    sort?: string;
    order?: "asc" | "desc";
  }): Promise<{ talks: Talk[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.limit) query.set("limit", params.limit.toString());
    if (params.q) query.set("q", params.q);
    if (params.tag) query.set("tag", params.tag);
    if (params.sort) query.set("sort", params.sort);
    if (params.order) query.set("order", params.order);

    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/talks?${query.toString()}`, { headers });
    return handleResponse<{ talks: Talk[]; pagination: any }>(res, "Failed to fetch talks");
  },

  async getPopularTags(): Promise<string[]> {
    if (cachedPopularTags && cachedPopularTags.length > 0) {
      return cachedPopularTags;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/talks/tags`);
      const data = await handleResponse<{ tags: string[] }>(res, "Failed to load tags");
      cachedPopularTags = data.tags || [];
      return cachedPopularTags;
    } catch {
      return cachedPopularTags || [];
    }
  },

  async getTalkBySlug(slug: string): Promise<Talk> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/talks/${encodeURIComponent(slug)}`, { headers });
    const data = await handleResponse<{ talk: Talk }>(res, "Talk not found");
    return data.talk;
  },

  async getSimilarTalks(slug: string, k: number = 6): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/talks/${encodeURIComponent(slug)}/similar?k=${k}`);
      const data = await handleResponse<{ similar_talks: any[] }>(res, "Failed to fetch similar talks");
      return data.similar_talks || [];
    } catch {
      return [];
    }
  },

  // Recommendations
  async getRecommendations(params?: { k?: number; tags?: string[] }): Promise<{
    recommendations: Talk[];
    count: number;
    model_strategy: string;
    is_fallback: boolean;
    fallback_reason?: string;
  }> {
    const query = new URLSearchParams();
    if (params?.k) query.set("k", params.k.toString());
    if (params?.tags && params.tags.length > 0) query.set("tags", params.tags.join(","));

    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/recommendations?${query.toString()}`, { headers });
    return handleResponse<{
      recommendations: Talk[];
      count: number;
      model_strategy: string;
      is_fallback: boolean;
      fallback_reason?: string;
    }>(res, "Failed to fetch recommendations");
  },

  // Favorites
  async getFavorites(): Promise<Talk[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/favorites`, { headers });
    const data = await handleResponse<{ favorites: Talk[] }>(res, "Failed to fetch favorites");
    return data.favorites || [];
  },

  async addFavorite(slug: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/favorites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ slug }),
    });
    await handleResponse<any>(res, "Failed to add favorite");
  },

  async removeFavorite(slug: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/favorites/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers,
    });
    await handleResponse<any>(res, "Failed to remove favorite");
  },

  // Activity Tracking
  async logActivity(params: {
    event_type: "view" | "ted_click" | "search";
    slug?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      fetch(`${API_BASE_URL}/activity`, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      }).catch(() => {});
    } catch {
      // Ignored
    }
  },

  async getActivity(): Promise<ActivityEvent[]> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/activity`, { headers });
      const data = await handleResponse<{ activities: ActivityEvent[] }>(res, "Failed to load activity");
      return data.activities || [];
    } catch {
      return [];
    }
  },

  // Profile & Preferences
  async getProfile(): Promise<{ user: any; profile: UserProfile | null }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/profile`, { headers });
    return handleResponse<{ user: any; profile: UserProfile | null }>(res, "Failed to load profile");
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/profile`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(updates),
    });
    const data = await handleResponse<{ profile: UserProfile }>(res, "Failed to update profile");
    return data.profile;
  },

  async getPreferences(): Promise<UserPreferences> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/preferences`, { headers });
    const data = await handleResponse<{ preferences: UserPreferences }>(res, "Failed to fetch preferences");
    return data.preferences;
  },

  async updatePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/preferences`, {
      method: "PUT",
      headers,
      body: JSON.stringify(updates),
    });
    const data = await handleResponse<{ preferences: UserPreferences }>(res, "Failed to update preferences");
    return data.preferences;
  },
};
