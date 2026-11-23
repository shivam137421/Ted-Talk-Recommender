import { Router, Request, Response, NextFunction } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { mlService } from "../services/ml.service.js";
import { supabasePublic, supabaseAdmin } from "../services/supabase.service.js";

const router = Router();

/**
 * GET /api/recommendations
 * Personalized recommendations for authenticated users or cold-start recommendations for guests.
 */
router.get("/", optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const k = Math.min(30, Math.max(1, parseInt((req.query.k as string) || "10", 10)));
    let favoriteSlugs: string[] = [];
    let preferredTags: string[] = [];

    if (req.user) {
      const dbClient = req.supabaseClient || supabaseAdmin || supabasePublic;

      // 1. Fetch user's favorite slugs
      const { data: favs } = await dbClient
        .from("favorites")
        .select("talks(slug)")
        .eq("user_id", req.user.id);

      if (favs && favs.length > 0) {
        favoriteSlugs = favs
          .map((f: any) => f.talks?.slug)
          .filter(Boolean);
      }

      // 2. Fetch user's onboarding preferences
      const { data: prefs } = await dbClient
        .from("user_preferences")
        .select("preferred_tags")
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (prefs && prefs.preferred_tags) {
        preferredTags = prefs.preferred_tags;
      }
    } else {
      // Guest user query params (e.g. temporary tag selection)
      const tagsQuery = (req.query.tags as string) || "";
      if (tagsQuery) {
        preferredTags = tagsQuery.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      }
    }

    // Call ML recommendation engine
    const recResult = await mlService.getRecommendations({
      favoriteSlugs,
      preferredTags,
      k,
      excludeSlugs: favoriteSlugs,
    });

    // Hydrate recommended items with full talk catalog metadata
    const slugs = recResult.recommendations.map((r) => r.slug);
    let hydratedItems: any[] = [];

    if (slugs.length > 0) {
      const { data: talksData } = await supabasePublic
        .from("talks")
        .select("id, slug, title, speaker, speaker_occupation, description, tags, views, duration_seconds, published_at, ted_url")
        .in("slug", slugs);

      const talksMap = new Map((talksData || []).map((t: any) => [t.slug, t]));

      hydratedItems = recResult.recommendations.map((r) => {
        const talk = talksMap.get(r.slug) || {};
        return {
          ...talk,
          slug: r.slug,
          score: r.score,
          source: r.source,
          explanation: r.explanation,
          is_fallback: r.is_fallback || false,
        };
      });
    }

    res.status(200).json({
      recommendations: hydratedItems,
      count: hydratedItems.length,
      model_strategy: recResult.model_strategy,
      is_fallback: recResult.is_fallback,
      fallback_reason: recResult.fallback_reason || null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

