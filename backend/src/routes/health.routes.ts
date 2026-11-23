import { Router, Request, Response } from "express";
import { supabasePublic } from "../services/supabase.service.js";
import { env } from "../config/env.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  let dbStatus = "unknown";
  let mlStatus = "unknown";

  // Check Supabase connectivity
  try {
    const { error } = await supabasePublic.from("talks").select("id").limit(1);
    dbStatus = error ? `unhealthy: ${error.message}` : "connected";
  } catch (err: any) {
    dbStatus = `unreachable: ${err.message}`;
  }

  // Check ML microservice connectivity
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const mlRes = await fetch(`${env.ML_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    mlStatus = mlRes.ok ? "connected" : `HTTP ${mlRes.status}`;
  } catch (err: any) {
    mlStatus = `unreachable (${err.message})`;
  }

  res.status(200).json({
    status: "healthy",
    service: "talkwise-backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    dependencies: {
      database: dbStatus,
      ml_service: mlStatus,
    },
  });
});

export default router;

