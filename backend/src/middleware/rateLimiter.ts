import rateLimit from "express-rate-limit";

/**
 * Strict rate limiter for sensitive authentication endpoints (login, registration).
 * Protects against brute-force credential stuffing and password guessing.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Too many authentication attempts. Please try again after 15 minutes.",
  },
});

/**
 * Public catalog & recommendation rate limiter.
 * Accommodates active catalog browsing, pagination, search, and filtering
 * without artificially interrupting normal user browsing.
 * Skips counting static media thumbnails and health checks.
 */
export const catalogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500, // 1,500 requests per 15 minutes (~100/min) per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const path = req.originalUrl || req.url || "";
    // Exempt media thumbnails and health probes from counting against catalog rate limits
    return path.includes("/thumbnail") || path.includes("/health");
  },
  message: {
    error: "Too Many Requests",
    message: "Catalog browsing rate limit reached. Please wait a moment before making more requests.",
  },
});

/**
 * Dedicated media limiter for TED talk thumbnails.
 * High-capacity limiter with browser-cache headers ensuring media loads smoothly.
 */
export const thumbnailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // 5,000 thumbnail requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Media request rate limit reached. Please wait a moment.",
  },
});

// Alias for backward compatibility
export const generalLimiter = catalogLimiter;
