import { env } from "../config/env.js";
import { supabasePublic } from "./supabase.service.js";

export interface MLRecommendationItem {
  slug: string;
  score: number;
  source: string;
  explanation: string;
  is_fallback?: boolean;
  fallback_reason?: string;
}

export interface RecommendationResponse {
  recommendations: MLRecommendationItem[];
  count: number;
  model_strategy: string;
  is_fallback: boolean;
  fallback_reason?: string;
}

export interface SimilarTalkItem {
  slug: string;
  title: string;
  speaker: string;
  similarity_score: number;
}

export class MLService {
  private baseUrl: string;
  private internalKey: string;

  constructor() {
    this.baseUrl = env.ML_SERVICE_URL;
    this.internalKey = env.ML_INTERNAL_KEY;
  }

  /**
   * Request recommendations from the Python ML service.
   * If ML service is unreachable, automatically falls back to database popularity.
   */
  async getRecommendations(params: {
    favoriteSlugs?: string[];
    preferredTags?: string[];
    k?: number;
    excludeSlugs?: string[];
    includeFavorites?: boolean;
  }): Promise<RecommendationResponse> {
    const k = params.k || 10;
    const url = `${this.baseUrl}/recommend`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": this.internalKey,
        },
        body: JSON.stringify({
          favorite_slugs: params.favoriteSlugs || [],
          preferred_tags: params.preferredTags || [],
          k: k,
          exclude_slugs: params.excludeSlugs || [],
          include_favorites: params.includeFavorites || false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ML service returned HTTP ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as any;
      return {
        recommendations: (data.recommendations || []).map((r: any) => ({
          ...r,
          is_fallback: false,
        })),
        count: data.count || (data.recommendations || []).length,
        model_strategy: data.model_strategy || "hybrid",
        is_fallback: false,
      };
    } catch (err: any) {
      console.warn(`[MLService Warning] Failed to reach ML service (${err.message}). Using DB popularity fallback.`);
      return this.getPopularityFallback(k, params.excludeSlugs);
    }
  }

  /**
   * Fetch similar talks for a given talk slug.
   */
  async getSimilarTalks(slug: string, k: number = 10): Promise<SimilarTalkItem[]> {
    const url = `${this.baseUrl}/similar/${encodeURIComponent(slug)}?k=${k}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      return data.similar_talks || [];
    } catch (err: any) {
      console.warn(`[MLService Warning] Similar talks failed for ${slug} (${err.message}). Falling back to tag query.`);
      return this.getTagSimilarFallback(slug, k);
    }
  }

  /**
   * Natural language semantic search using ML service TF-IDF cosine similarity.
   */
  async searchTalks(query: string, k: number = 30): Promise<{ slug: string; score: number }[]> {
    if (!query || !query.trim()) return [];
    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query.trim())}&k=${k}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      return (data.results || []).map((r: any) => ({
        slug: r.slug,
        score: r.score,
      }));
    } catch (err: any) {
      console.warn(`[MLService Warning] Semantic search failed for '${query}' (${err.message}).`);
      return [];
    }
  }

  /**
   * Non-personalized popularity fallback served directly from Supabase PostgreSQL catalog.
   */
  private async getPopularityFallback(
    k: number = 10,
    excludeSlugs?: string[]
  ): Promise<RecommendationResponse> {
    try {
      let query = supabasePublic
        .from("talks")
        .select("slug, views, title, speaker")
        .order("views", { ascending: false })
        .limit(k + (excludeSlugs?.length || 0));

      const { data, error } = await query;
      if (error) throw error;

      const banned = new Set(excludeSlugs || []);
      const filtered = (data || [])
        .filter((item: any) => !banned.has(item.slug))
        .slice(0, k);

      const recommendations: MLRecommendationItem[] = filtered.map((talk: any) => ({
        slug: talk.slug,
        score: Number(talk.views) || 0,
        source: "database_popularity_fallback",
        explanation: "Trending and highly viewed across TED (Popularity Fallback)",
        is_fallback: true,
        fallback_reason: "ML recommendation service unavailable; displaying most popular talks snapshot.",
      }));

      return {
        recommendations,
        count: recommendations.length,
        model_strategy: "popularity_database_fallback",
        is_fallback: true,
        fallback_reason: "ML recommendation service unavailable; displaying most popular talks snapshot.",
      };
    } catch (dbErr: any) {
      console.error("[MLService Error] Database fallback also failed:", dbErr);
      return {
        recommendations: [],
        count: 0,
        model_strategy: "none",
        is_fallback: true,
        fallback_reason: "Service unavailable.",
      };
    }
  }

  /**
   * Database tag-based similarity fallback for single-talk similar queries.
   */
  private async getTagSimilarFallback(slug: string, k: number = 10): Promise<SimilarTalkItem[]> {
    try {
      const { data: targetTalk, error: targetErr } = await supabasePublic
        .from("talks")
        .select("tags")
        .eq("slug", slug)
        .single();

      if (targetErr || !targetTalk) return [];

      const tags = targetTalk.tags || [];
      if (tags.length === 0) return [];

      const { data: similarTalks, error: simErr } = await supabasePublic
        .from("talks")
        .select("slug, title, speaker")
        .overlaps("tags", tags)
        .neq("slug", slug)
        .order("views", { ascending: false })
        .limit(k);

      if (simErr || !similarTalks) return [];

      return similarTalks.map((t: any) => ({
        slug: t.slug,
        title: t.title,
        speaker: t.speaker,
        similarity_score: 0.5,
      }));
    } catch {
      return [];
    }
  }
}

export const mlService = new MLService();

