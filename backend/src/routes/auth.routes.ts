import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabasePublic, supabaseAdmin } from "../services/supabase.service.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Identifier must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * GET /api/auth/check-username?username=...
 * Case-insensitive username availability check.
 */
router.get("/check-username", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawUsername = (req.query.username as string || "").trim().toLowerCase();
    if (!rawUsername) {
      res.status(200).json({ available: false, message: "Username cannot be empty" });
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(rawUsername)) {
      res.status(200).json({
        available: false,
        message: "Username must be 3-30 characters with lowercase letters, numbers, or underscores only",
      });
      return;
    }

    const dbClient = supabaseAdmin || supabasePublic;
    const { data: profile } = await dbClient
      .from("profiles")
      .select("id")
      .eq("username", rawUsername)
      .maybeSingle();

    res.status(200).json({
      available: !profile,
      username: rawUsername,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Dual login accepting either an email address or a unique username.
 */
router.post("/login", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    let resolvedEmail = identifier;

    // If identifier is not an email (does not contain '@'), resolve via profiles table
    const dbClient = supabaseAdmin || supabasePublic;
    if (!identifier.includes("@")) {
      const usernameLower = identifier.toLowerCase();

      // Query profiles table for corresponding user ID
      const { data: profile, error: profileErr } = await dbClient
        .from("profiles")
        .select("id")
        .eq("username", usernameLower)
        .maybeSingle();

      if (profileErr || !profile) {
        // Return generic 401 to prevent username enumeration
        throw new ApiError(401, "Invalid credentials");
      }

      // Look up user email using admin auth API if available
      if (!supabaseAdmin) {
        throw new ApiError(500, "Username login temporarily unavailable; please log in with your email.");
      }

      const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (userErr || !userData.user || !userData.user.email) {
        throw new ApiError(401, "Invalid credentials");
      }

      resolvedEmail = userData.user.email;
    }

    // Authenticate with resolved email and password
    const { data: authData, error: authErr } = await supabasePublic.auth.signInWithPassword({
      email: resolvedEmail,
      password: password,
    });

    if (authErr || !authData.session) {
      if (authErr) {
        const msg = authErr.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("unverified")) {
          throw new ApiError(
            403,
            "Your email address has not been verified. Please check your inbox for the OTP verification code."
          );
        }
        if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
          throw new ApiError(401, "Invalid email/username or password. Please verify your credentials.");
        }
        throw new ApiError(401, authErr.message || "Invalid credentials");
      }
      throw new ApiError(401, "Authentication session could not be established.");
    }

    // Retrieve user profile with self-healing fallback
    let userProfile = null;
    const { data: p } = await dbClient
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();
    userProfile = p;

    if (!userProfile) {
      const meta = authData.user.user_metadata || {};
      const candidateUsername = (
        meta.username ||
        meta.user_name ||
        `user_${authData.user.id.replace(/-/g, "").slice(0, 10)}`
      ).toLowerCase().trim();
      const candidateFullName = meta.full_name || meta.name || null;
      const candidateAvatar = meta.avatar_url || meta.picture || null;

      const { data: newP } = await dbClient
        .from("profiles")
        .insert({
          id: authData.user.id,
          username: candidateUsername,
          full_name: candidateFullName,
          avatar_url: candidateAvatar,
          bio: "",
        })
        .select()
        .maybeSingle();
      userProfile = newP;
    }

    res.status(200).json({
      message: "Login successful",
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
      },
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile: userProfile || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

