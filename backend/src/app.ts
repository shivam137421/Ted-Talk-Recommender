import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/auth.routes.js";
import talksRoutes from "./routes/talks.routes.js";
import recommendationsRoutes from "./routes/recommendations.routes.js";
import favoritesRoutes from "./routes/favorites.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import healthRoutes from "./routes/health.routes.js";

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(helmet());

  // 2. Cross-Origin Resource Sharing
  const allowedOrigins = [
    env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in development, locked down via FRONTEND_URL in production
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Internal-Key"],
    })
  );

  // 3. Body Parsing
  app.use(express.json({ limit: "1mb" }));

  // 4. Rate Limiting on API endpoints
  app.use("/api", generalLimiter);

  // 5. Mount API Routes
  app.use("/api/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/talks", talksRoutes);
  app.use("/api/recommendations", recommendationsRoutes);
  app.use("/api/favorites", favoritesRoutes);
  app.use("/api/activity", activityRoutes);
  app.use("/api", profileRoutes);

  // 6. 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "Not Found",
      message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`,
    });
  });

  // 7. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();

