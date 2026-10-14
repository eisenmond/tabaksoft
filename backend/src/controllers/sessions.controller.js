import { asyncHandler } from "../lib/async-handler.js";
import { notFound } from "../lib/errors.js";

const response = (session, currentId) => ({ id: session._id.toString(), current: session._id.toString() === currentId, userAgent: session.userAgent, ip: session.ip, createdAt: session.createdAt, lastUsedAt: session.lastUsedAt, expiresAt: session.expiresAt });
export function createSessionsController({ sessions }) { return {
  list: asyncHandler(async (req, res) => res.json({ data: { items: (await sessions.listForUser(req.auth.sub)).map((item) => response(item, req.auth.sid)) } })),
  revoke: asyncHandler(async (req, res) => { if (!await sessions.revoke(req.params.sessionId, req.auth.sub)) throw notFound("Session"); res.status(204).send(); }),
  revokeOthers: asyncHandler(async (req, res) => { await sessions.revokeOthers(req.auth.sub, req.auth.sid); res.status(204).send(); }),
}; }
