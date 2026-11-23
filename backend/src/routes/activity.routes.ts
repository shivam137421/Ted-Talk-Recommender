import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";
import { supabaseAdmin, supabasePublic } from "../services/supabase.service.js";

const router = Router();

const activitySchema = z.object({
  event_type: z.enum(["view", "ted_click", "search", "favorite", "unfavorite"]),
  slug: z.string().trim().optional(),
  metadata: z.record(z.any()).default({}),
});

/**
 * POST /api/activity
 * Log user interaction event (view, ted_click, search).
 */
router.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event_type, slug, metadata } = activitySchema.parse(req.body);
    const dbClient = req.supabaseClient || supabaseAdmin || supabasePublic;
    const userId = req.user!.id;

    let talkId: number | null = null;
    if (slug) {
      const { data: talk } = await dbClient
        .from("talks")
        .select("id")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();

      if (talk) talkId = talk.id;
    }

    const { error } = await dbClient.from("user_activity").insert({
      user_id: userId,
      talk_id: talkId,
      event_type,
      metadata,
    });

    if (error) throw new ApiError(500, error.message);

    res.status(201).json({ message: "Activity logged" });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/activity
 * Fetch the authenticated user's recent activity history.
 */
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbClient = req.supabaseClient || supabaseAdmin || supabasePublic;
    const userId = req.user!.id;

    const { data: activities, error } = await dbClient
      .from("user_activity")
      .select("id, event_type, metadata, created_at, talks(slug, title, speaker)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new ApiError(500, error.message);

    res.status(200).json({
      activities: activities || [],
      count: (activities || []).length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

