import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";
import { supabaseAdmin, supabasePublic } from "../services/supabase.service.js";

const router = Router();

const favoriteSchema = z.object({
  slug: z.string().trim().min(1, "Talk slug is required"),
});

/**
 * GET /api/favorites
 * List all talks favorited by the authenticated user.
 */
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbClient = req.supabaseClient || supabaseAdmin || supabasePublic;
    const userId = req.user!.id;

    const { data: favs, error } = await dbClient
      .from("favorites")
      .select("created_at, talks(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new ApiError(500, error.message);

    const favorites = (favs || []).map((f: any) => ({
      favorited_at: f.created_at,
      ...f.talks,
      is_favorited: true,
    }));

    res.status(200).json({
      favorites,
      count: favorites.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/favorites
 * Add a talk to the authenticated user's favorites and log the interaction.
 */
router.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = favoriteSchema.parse(req.body);
    const dbClient = req.supabaseClient || supabaseAdmin || supabasePublic;
    const userId = req.user!.id;

    // 1. Resolve talk ID from slug
    const { data: talk, error: talkErr } = await dbClient
      .from("talks")
      .select("id, slug, title")
      .eq("slug", slug)
      .maybeSingle();

    if (talkErr || !talk) {
      throw new ApiError(404, `Talk with slug '${slug}' not found`);
    }

    // 2. Insert into favorites
    const { error: favErr } = await dbClient
      .from("favorites")
      .upsert(
        { user_id: userId, talk_id: talk.id },
        { onConflict: "user_id,talk_id", ignoreDuplicates: true }
      );

    if (favErr) throw new ApiError(500, favErr.message);

    // 3. Log activity event
    dbClient
      .from("user_activity")
      .insert({
        user_id: userId,
        talk_id: talk.id,
        event_type: "favorite",
        metadata: { slug, title: talk.title },
      })
      .then(() => {})
      .catch((e: any) => console.warn("Failed to log activity:", e.message));

    res.status(201).json({
      message: "Talk favorited successfully",
      slug: talk.slug,
      is_favorited: true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/favorites/:slug
 * Remove a talk from the authenticated user's favorites.
 */
router.delete("/:slug", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug.trim().toLowerCase();
    const dbClient = req.supabaseClient || supabaseAdmin || supabasePublic;
    const userId = req.user!.id;

    // Resolve talk ID
    const { data: talk } = await dbClient
      .from("talks")
      .select("id, slug, title")
      .eq("slug", slug)
      .maybeSingle();

    if (!talk) {
      throw new ApiError(404, `Talk with slug '${slug}' not found`);
    }

    const { error: delErr } = await dbClient
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("talk_id", talk.id);

    if (delErr) throw new ApiError(500, delErr.message);

    // Log unfavorite event
    dbClient
      .from("user_activity")
      .insert({
        user_id: userId,
        talk_id: talk.id,
        event_type: "unfavorite",
        metadata: { slug, title: talk.title },
      })
      .then(() => {})
      .catch((e: any) => console.warn("Failed to log activity:", e.message));

    res.status(200).json({
      message: "Talk removed from favorites",
      slug,
      is_favorited: false,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

