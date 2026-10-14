import { asyncHandler } from "../lib/async-handler.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { verifyToken } from "../lib/jwt.js";

export const authenticate = (config, { users, sessions }) => asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.get("authorization") || "").split(" ");
  if (scheme !== "Bearer" || !token) throw unauthorized("Use a Bearer access token");
  req.auth = verifyToken(token, config);
  const user = await users.findById(req.auth.sub);
  if (!user || user.status === "suspended") throw forbidden("This account is unavailable");
  if (!req.auth.sid || !await sessions.isActive(req.auth.sid, req.auth.sub)) throw unauthorized("Session has expired or was revoked");
  req.auth.role = user.role;
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.auth?.role)) return next(forbidden());
  return next();
};
