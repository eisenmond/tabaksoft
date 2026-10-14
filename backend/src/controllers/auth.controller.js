import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, conflict, forbidden, unauthorized } from "../lib/errors.js";
import { signToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { email, password, requireString } from "../lib/validation.js";
import { userResponse } from "../lib/serializers.js";
import { newOpaqueToken, tokenDigest } from "../lib/account-tokens.js";

const cookieValue = (req, name) => Object.fromEntries((req.get("cookie") || "").split(";").map((part) => part.trim().split("=").map(decodeURIComponent)))[name];
const expiresAt = (seconds) => new Date(Date.now() + seconds * 1000);

export function refreshCookieOptions(config, maxAge = config.refreshExpiresSeconds * 1000) {
  return {
    httpOnly: true,
    secure: config.refreshCookieSecure,
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge,
  };
}

export function createAuthController({ users, sessions, accountTokens, config, sendAccountEmail }) {
  const setRefreshCookie = (res, value, maxAge) => res.cookie(config.refreshCookieName, value, refreshCookieOptions(config, maxAge));
  const createSession = async (req, res, user, status = 200) => {
    const refreshToken = newOpaqueToken();
    const session = await sessions.createSession({ userId: user._id.toString(), refreshTokenHash: tokenDigest(refreshToken), expiresAt: expiresAt(config.refreshExpiresSeconds), userAgent: (req.get("user-agent") || "").slice(0, 300), ip: req.ip });
    setRefreshCookie(res, refreshToken);
    return res.status(status).json({ data: { user: userResponse(user), accessToken: signToken({ userId: user._id.toString(), role: user.role, sessionId: session._id.toString() }, config) } });
  };
  const issueEmailToken = async (user, type, ttl, path) => {
    const token = newOpaqueToken();
    await accountTokens.issue({ userId: user._id.toString(), type, tokenHash: tokenDigest(token), expiresAt: expiresAt(ttl) });
    const url = `${config.clientOrigin.split(",")[0]}${path}?token=${encodeURIComponent(token)}`;
    await sendAccountEmail({ to: user.email, type, url, name: user.name });
    return config.exposeAccountTokens ? url : undefined;
  };

  return {
    login: asyncHandler(async (req, res) => {
      const user = await users.findByEmail(email(req.body.email));
      if (!user || !user.passwordHash || !(await verifyPassword(password(req.body.password), user.passwordHash))) throw unauthorized("Email or password is incorrect");
      if (user.status === "suspended") throw forbidden("This account is suspended");
      if (!user.emailVerifiedAt) throw forbidden("Verify your email address before signing in");
      return createSession(req, res, user);
    }),
    refresh: asyncHandler(async (req, res) => {
      const oldToken = cookieValue(req, config.refreshCookieName); if (!oldToken) throw unauthorized("Refresh session is missing");
      const session = await sessions.findActiveByHash(tokenDigest(oldToken)); if (!session) throw unauthorized("Refresh session is invalid or expired");
      const user = await users.findById(session.userId); if (!user || user.status === "suspended") { await sessions.revokeAll(session.userId); throw forbidden("This account is unavailable"); }
      const newToken = newOpaqueToken();
      const rotated = await sessions.rotate(session._id.toString(), tokenDigest(oldToken), tokenDigest(newToken), expiresAt(config.refreshExpiresSeconds));
      if (!rotated) throw unauthorized("Refresh session has already been used");
      setRefreshCookie(res, newToken);
      res.json({ data: { user: userResponse(user), accessToken: signToken({ userId: user._id.toString(), role: user.role, sessionId: session._id.toString() }, config) } });
    }),
    logout: asyncHandler(async (req, res) => { const token = cookieValue(req, config.refreshCookieName); if (token) { const session = await sessions.findActiveByHash(tokenDigest(token)); if (session) await sessions.revoke(session._id.toString(), session.userId); } setRefreshCookie(res, "", 0); res.status(204).send(); }),
    requestPasswordReset: asyncHandler(async (req, res) => { const user = await users.findByEmail(email(req.body.email)); let previewUrl; if (user && user.status !== "suspended") previewUrl = await issueEmailToken(user, "password-reset", config.resetExpiresSeconds, "/reset-password"); res.status(202).json({ data: { message: "If that account exists, a password reset email has been sent", ...(previewUrl ? { previewUrl } : {}) } }); }),
    resetPassword: asyncHandler(async (req, res) => { const rawToken = requireString(req.body.token, "token", { min: 20, max: 200 }); const rawPassword = password(req.body.password); const record = await accountTokens.consume(tokenDigest(rawToken), "password-reset"); if (!record) throw badRequest("Password reset token is invalid or expired"); await users.setPassword(record.userId, await hashPassword(rawPassword)); await sessions.revokeAll(record.userId); res.json({ data: { message: "Password updated" } }); }),
    verifyEmail: asyncHandler(async (req, res) => { const rawToken = requireString(req.body.token, "token", { min: 20, max: 200 }); const record = await accountTokens.consume(tokenDigest(rawToken), "email-verification"); if (!record) throw badRequest("Verification token is invalid or expired"); const user = await users.updateAccount(record.userId, { emailVerifiedAt: new Date() }); res.json({ data: userResponse(user) }); }),
    resendVerification: asyncHandler(async (req, res) => { const user = await users.findByEmail(email(req.body.email)); let previewUrl; if (user && !user.emailVerifiedAt && user.status !== "suspended") previewUrl = await issueEmailToken(user, "email-verification", config.verificationExpiresSeconds, "/verify-email"); res.status(202).json({ data: { message: "If verification is pending, an email has been sent", ...(previewUrl ? { previewUrl } : {}) } }); }),
    acceptInvitation: asyncHandler(async (req, res) => { const rawToken = requireString(req.body.token, "token", { min: 20, max: 200 }); const rawPassword = password(req.body.password); const record = await accountTokens.consume(tokenDigest(rawToken), "invitation"); if (!record) throw badRequest("Invitation is invalid or expired"); const user = await users.findById(record.userId); if (!user || user.status === "suspended") throw forbidden("This invitation is unavailable"); if (config.termsVersion && req.body.termsVersion !== config.termsVersion) throw badRequest(`termsVersion must be ${config.termsVersion}`); if (config.privacyVersion && req.body.privacyVersion !== config.privacyVersion) throw badRequest(`privacyVersion must be ${config.privacyVersion}`); const acceptedTerms = (config.termsVersion || config.privacyVersion) ? { termsVersion: config.termsVersion || null, privacyVersion: config.privacyVersion || null, acceptedAt: new Date(), ip: req.ip } : null; const activated = await users.setPassword(user._id.toString(), await hashPassword(rawPassword), { emailVerifiedAt: new Date(), acceptedTerms }); return createSession(req, res, activated, 201); }),
    changePassword: asyncHandler(async (req, res) => { const user = await users.findById(req.auth.sub); if (!await verifyPassword(password(req.body.currentPassword), user.passwordHash)) throw unauthorized("Current password is incorrect"); const next = password(req.body.newPassword); if (req.body.currentPassword === next) throw conflict("New password must be different"); await users.setPassword(req.auth.sub, await hashPassword(next)); await sessions.revokeOthers(req.auth.sub, req.auth.sid); res.status(204).send(); }),
  };
}
