import { Request, Response, NextFunction } from "express";
import { User } from "@supabase/supabase-js";
import { supabasePublic, getAuthenticatedClient } from "../services/supabase.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      accessToken?: string;
      supabaseClient?: any;
    }
  }
}

/**
 * Middleware requiring a valid Supabase JWT Bearer token in the Authorization header.
 * Rejects with 401 Unauthorized if missing, malformed, or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authorization token required (Bearer <token>)",
    });
    return;
  }

  const token = authHeader.split(" ")[1].trim();
  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Malformed Bearer token",
    });
    return;
  }

  try {
    const { data: { user }, error } = await supabasePublic.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired session token",
      });
      return;
    }

    req.user = user;
    req.accessToken = token;
    req.supabaseClient = getAuthenticatedClient(token);
    next();
  } catch (err: any) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Failed to authenticate token",
    });
  }
}

/**
 * Optional authentication middleware.
 * If Bearer token is provided and valid, attaches user; otherwise proceeds as anonymous.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1].trim();
    if (token) {
      try {
        const { data: { user } } = await supabasePublic.auth.getUser(token);
        if (user) {
          req.user = user;
          req.accessToken = token;
          req.supabaseClient = getAuthenticatedClient(token);
        }
      } catch {
        // Continue unauthenticated on error
      }
    }
  }
  next();
}

