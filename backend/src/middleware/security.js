import { AppError } from "../lib/errors.js";

export function securityHeaders(_req, res, next) {
  res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Powered-By": "" });
  next();
}

export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100 } = {}) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now(); const key = req.ip; const previous = hits.get(key) || [];
    const recent = previous.filter((time) => now - time < windowMs);
    if (recent.length >= max) return next(new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later."));
    recent.push(now); hits.set(key, recent); return next();
  };
}

export function notFoundHandler(req, _res, next) { next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} was not found`)); }
export function errorHandler(error, _req, res, _next) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { code: error.code || "INTERNAL_ERROR", message: status >= 500 ? "An unexpected error occurred" : error.message, ...(error.details ? { details: error.details } : {}) } });
}
