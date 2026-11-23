import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";
import { supabaseAdmin, supabasePublic } from "../services/supabase.service.js";

const router = Router();

const updateProfileSchema = z.object({
  full_name: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(500).optional(),
  avatar_url: z.string().url().or(z.literal("")).optional(),
});

const updatePreferencesSchema = z.object({
  preferred_tags: z.array(z.string().trim().toLowerCase()).default([]),
  onboarding_completed: z.boolean().default(true),
  settings: z.record(z.any()).default({}),
});

/**
 * GET /api/profile
 * Get authenticated user's profile.
 */
router.get("/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = req.supabaseClient;
    const userId = req.user!.id;

    const { data: profile, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new ApiError(500, error.message);

    let activeProfile = profile;

    // Self-healing: if profile row does not exist, initialize from auth metadata
    if (!activeProfile) {
      let meta = (req.user as any).user_metadata || {};
      if (supabaseAdmin && (!meta.full_name && !meta.username)) {
        try {
          const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(userId);
          if (adminUser?.user?.user_metadata) {
            meta = { ...adminUser.user.user_metadata, ...meta };
          }
        } catch {
          // Non-blocking fallback
        }
      }

      const candidateUsername = (
        meta.username ||
        meta.user_name ||
        `user_${userId.replace(/-/g, "").slice(0, 10)}`
      ).toLowerCase().trim();
      const candidateFullName = meta.full_name || meta.name || null;
      const candidateAvatar = meta.avatar_url || meta.picture || null;

      const adminClient = supabaseAdmin || client;
      const { data: newProfile, error: insertErr } = await adminClient
        .from("profiles")
        .insert({
          id: userId,
          username: candidateUsername,
          full_name: candidateFullName,
          avatar_url: candidateAvatar,
          bio: "",
        })
        .select()
        .maybeSingle();

      if (!insertErr && newProfile) {
        activeProfile = newProfile;
      }
    }

    res.status(200).json({
      user: {
        id: req.user!.id,
        email: req.user!.email,
      },
      profile: activeProfile || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/profile
 * Update profile details (full name, bio, avatar).
 */
router.patch("/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = updateProfileSchema.parse(req.body);
    const client = req.supabaseClient;
    const userId = req.user!.id;

    const { data: profile, error } = await client
      .from("profiles")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);

    res.status(200).json({
      message: "Profile updated successfully",
      profile,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/preferences
 * Get cold-start onboarding topic preferences.
 */
router.get("/preferences", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = req.supabaseClient || supabaseAdmin || supabasePublic;
    const userId = req.user!.id;

    const { data: prefs, error } = await client
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new ApiError(500, error.message);

    res.status(200).json({
      preferences: prefs || {
        user_id: userId,
        preferred_tags: [],
        onboarding_completed: false,
        settings: {},
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/preferences
 * Update user cold-start topic preferences and onboarding status.
 */
router.put("/preferences", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preferred_tags, onboarding_completed, settings } = updatePreferencesSchema.parse(req.body);
    const client = req.supabaseClient || supabaseAdmin || supabasePublic;
    const userId = req.user!.id;

    const { data: prefs, error } = await client
      .from("user_preferences")
      .upsert(
        {
          user_id: userId,
          preferred_tags,
          onboarding_completed,
          settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);

    res.status(200).json({
      message: "Preferences updated",
      preferences: prefs,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

