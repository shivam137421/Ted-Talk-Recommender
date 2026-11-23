import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabasePublic, supabaseAdmin } from "../services/supabase.service.js";
import { mlService } from "../services/ml.service.js";
import { optionalAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";
import { thumbnailLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const thumbnailCache = new Map<string, string | null>();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  sort: z.enum(["relevance", "views", "published_at", "title", "duration_seconds"]).default("views"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/talks
 * Search (keyword + natural language semantic), filter by tag, sort, and paginate the talks catalog.
 */
router.get("/", optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, q, tag, sort, order } = querySchema.parse(req.query);
    const offset = (page - 1) * limit;

    let matchingSlugs: string[] | null = null;

    if (q) {
      const qTrim = q.trim();

      // 1. Natural language semantic search via ML TF-IDF
      const mlMatches = await mlService.searchTalks(qTrim, 80);
      const mlSlugs = mlMatches.map((m) => m.slug);

      // 2. Direct substring search on title, speaker, description
      const { data: dbMatches } = await supabasePublic
        .from("talks")
        .select("slug")
        .or(`title.ilike.%${qTrim}%,speaker.ilike.%${qTrim}%,description.ilike.%${qTrim}%`)
        .limit(50);
      const dbSlugs = (dbMatches || []).map((m: any) => m.slug);

      // 3. Union with priority to exact speaker/title matches
      const combined = new Set<string>();
      dbSlugs.forEach((s) => combined.add(s));
      mlSlugs.forEach((s) => combined.add(s));

      matchingSlugs = Array.from(combined);
      if (matchingSlugs.length === 0) {
        res.status(200).json({
          talks: [],
          pagination: {
            total: 0,
            page: 1,
            limit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
        return;
      }
    }

    let query = supabasePublic.from("talks").select("*", { count: "exact" });

    if (matchingSlugs !== null) {
      query = query.in("slug", matchingSlugs);
    }

    // Tag filter
    if (tag) {
      query = query.contains("tags", [tag.toLowerCase()]);
    }

    // Sorting and pagination
    if (!q || (req.query.sort && req.query.sort !== "relevance")) {
      const sortField = sort === "relevance" ? "views" : sort;
      query = query.order(sortField, { ascending: order === "asc" });
    }
    query = query.range(offset, offset + limit - 1);

    const { data: talks, count, error } = await query;
    if (error) {
      throw new ApiError(500, `Database query failed: ${error.message}`);
    }

    // If query was searched by relevance, sort the page by semantic match ranking
    let orderedTalks = talks || [];
    if (q && (!req.query.sort || req.query.sort === "relevance") && matchingSlugs) {
      const slugRank = new Map(matchingSlugs.map((s, idx) => [s, idx]));
      orderedTalks = [...orderedTalks].sort(
        (a, b) => (slugRank.get(a.slug) ?? 9999) - (slugRank.get(b.slug) ?? 9999)
      );
    }

    // If authenticated, check user favorites
    let favSet = new Set<number>();
    if (req.user) {
      const dbClient = req.supabaseClient || supabaseAdmin || supabasePublic;
      const { data: userFavs } = await dbClient
        .from("favorites")
        .select("talk_id")
        .eq("user_id", req.user.id);
      favSet = new Set((userFavs || []).map((f: any) => f.talk_id));
    }

    const hydratedTalks = (orderedTalks || []).map((t: any) => ({
      ...t,
      is_favorited: favSet.has(t.id),
      thumbnail_url: t.thumbnail_url || thumbnailCache.get(t.slug) || null,
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      talks: hydratedTalks,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/talks/tags
 * Top unique tags across catalog for filter chips and onboarding.
 */
router.get("/tags", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    const defaultPopularTags = [
      "technology", "science", "design", "business", "culture",
      "global issues", "health", "innovation", "education", "psychology",
      "art", "environment", "creativity", "future", "humanity",
      "ai", "biology", "music", "history", "social change"
    ];
    res.status(200).json({ tags: defaultPopularTags });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/talks/:slug
 * Retrieve detailed metadata for a single talk.
 */
router.get("/:slug", optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug.trim().toLowerCase();

    const { data: talk, error } = await supabasePublic
      .from("talks")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new ApiError(500, error.message);
    if (!talk) throw new ApiError(404, `Talk with slug '${slug}' not found`);

    let isFavorited = false;

    // If user is logged in, check if talk is in their favorites
    if (req.user) {
      const dbClient = req.supabaseClient || supabaseAdmin || supabasePublic;
      const { data: fav } = await dbClient
        .from("favorites")
        .select("talk_id")
        .eq("user_id", req.user.id)
        .eq("talk_id", talk.id)
        .maybeSingle();

      isFavorited = Boolean(fav);
    }

    res.status(200).json({
      talk: {
        ...talk,
        is_favorited: isFavorited,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/talks/:slug/similar
 * Retrieve content-based similar talks for a talk, hydrated with full metadata.
 */
router.get("/:slug/similar", optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug.trim().toLowerCase();
    const k = Math.min(20, Math.max(1, parseInt((req.query.k as string) || "6", 10)));

    const similar = await mlService.getSimilarTalks(slug, k);
    if (!similar || similar.length === 0) {
      res.status(200).json({ slug, similar_talks: [], count: 0 });
      return;
    }

    const slugs = similar.map((s) => s.slug);
    const { data: talks } = await supabasePublic
      .from("talks")
      .select("*")
      .in("slug", slugs);

    const scoreMap = new Map(similar.map((s) => [s.slug, s.similarity_score || (s as any).score]));

    // Check favorites if user is authenticated
    let favSet = new Set<number>();
    if (req.user) {
      const dbClient = req.supabaseClient || supabaseAdmin || supabasePublic;
      const { data: favs } = await dbClient
        .from("favorites")
        .select("talk_id")
        .eq("user_id", req.user.id);
      favSet = new Set((favs || []).map((f: any) => f.talk_id));
    }

    const hydrated = (talks || [])
      .map((t: any) => ({
        ...t,
        score: scoreMap.get(t.slug) || 0,
        is_favorited: favSet.has(t.id),
      }))
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    res.status(200).json({
      slug,
      similar_talks: hydrated,
      count: hydrated.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/talks/:slug/thumbnail
 * Retrieve or proxy official TED oEmbed thumbnail URL with in-memory caching.
 */
router.get("/:slug/thumbnail", thumbnailLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug.trim().toLowerCase();
    res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    if (thumbnailCache.has(slug)) {
      res.status(200).json({ slug, thumbnail_url: thumbnailCache.get(slug) });
      return;
    }

    const oembedUrl = `https://www.ted.com/services/v1/oembed.json?url=https://www.ted.com/talks/${encodeURIComponent(slug)}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = (await resp.json()) as any;
        const thumb = data.thumbnail_url || null;
        thumbnailCache.set(slug, thumb);
        res.status(200).json({ slug, thumbnail_url: thumb });
        return;
      }
    } catch {
      // Ignore network timeout and fall back to null
    }

    thumbnailCache.set(slug, null);
    res.status(200).json({ slug, thumbnail_url: null });
  } catch (err) {
    next(err);
  }
});

export default router;

