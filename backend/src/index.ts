import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`[TalkWise Backend API] Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`[TalkWise Backend API] Connecting to ML service at ${env.ML_SERVICE_URL}`);
  console.log(`[TalkWise Backend API] Connecting to Supabase at ${env.SUPABASE_URL}`);
});

process.on("SIGTERM", () => {
  console.log("[TalkWise Backend API] SIGTERM received, shutting down gracefully");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[TalkWise Backend API] SIGINT received, shutting down gracefully");
  server.close(() => {
    process.exit(0);
  });
});

