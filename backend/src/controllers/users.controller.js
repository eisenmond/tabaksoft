import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { accountStatus, email, optionalString, requireString, userRole } from "../lib/validation.js";
import { userResponse } from "../lib/serializers.js";
import { newOpaqueToken, tokenDigest } from "../lib/account-tokens.js";

export function createUsersController({ users, sessions, accountTokens, config, sendAccountEmail }) { return {
  list: asyncHandler(async (req, res) => { const result = await users.list({ page: req.query.page, limit: req.query.limit, sort: { name: 1 } }); res.json({ data: { ...result, items: result.items.map(userResponse) } }); }),
  invite: asyncHandler(async (req, res) => {
    const name = requireString(req.body.name, "name", { min: 2, max: 80 }); const userEmail = email(req.body.email); const role = userRole(req.body.role || "user");
    if (await users.findByEmail(userEmail)) throw conflict("An account with this email already exists");
    const user = await users.createUser({ name, email: userEmail, role }); const token = newOpaqueToken();
    await accountTokens.issue({ userId: user._id.toString(), type: "invitation", tokenHash: tokenDigest(token), expiresAt: new Date(Date.now() + config.invitationExpiresSeconds * 1000) });
    const url = `${config.clientOrigin.split(",")[0]}/accept-invitation?token=${encodeURIComponent(token)}`; await sendAccountEmail({ to: user.email, name: user.name, type: "invitation", url });
    res.status(201).json({ data: { user: userResponse(user), ...(config.exposeAccountTokens ? { previewUrl: url } : {}) } });
  }),
  getMe: asyncHandler(async (req, res) => { const user = await users.findById(req.auth.sub); if (!user) throw notFound("User"); res.json({ data: userResponse(user) }); }),
  updateMe: asyncHandler(async (req, res) => { const name = optionalString(req.body.name, "name", { min: 2, max: 80 }); if (name === undefined) throw badRequest("Provide at least one editable profile field"); const user = await users.updateProfile(req.auth.sub, { name }); res.json({ data: userResponse(user) }); }),
  update: asyncHandler(async (req, res) => { const changes = {}; if (req.body.name !== undefined) changes.name = requireString(req.body.name, "name", { min: 2, max: 80 }); if (req.body.email !== undefined) { changes.email = email(req.body.email); changes.emailVerifiedAt = null; } if (req.body.role !== undefined) changes.role = userRole(req.body.role); if (req.body.status !== undefined) { changes.status = accountStatus(req.body.status); changes.suspendedAt = changes.status === "suspended" ? new Date() : null; } if (!Object.keys(changes).length) throw badRequest("Provide at least one editable account field"); const existingEmail = changes.email && await users.findByEmail(changes.email); if (existingEmail && existingEmail._id.toString() !== req.params.userId) throw conflict("An account with this email already exists"); if (req.params.userId === req.auth.sub && (changes.status === "suspended" || (changes.role && changes.role !== "admin"))) throw forbidden("Administrators cannot suspend or demote themselves"); const user = await users.updateAccount(req.params.userId, changes); if (!user) throw notFound("User"); if (changes.status === "suspended") await sessions.revokeAll(req.params.userId); res.json({ data: userResponse(user) }); }),
  remove: asyncHandler(async (req, res) => { if (req.params.userId === req.auth.sub) throw forbidden("Use the current-account endpoint to delete your own account"); if (!await users.deleteById(req.params.userId)) throw notFound("User"); await sessions.revokeAll(req.params.userId); await accountTokens.revokeForUser(req.params.userId); res.status(204).send(); }),
  deleteMe: asyncHandler(async (req, res) => { await sessions.revokeAll(req.auth.sub); await accountTokens.revokeForUser(req.auth.sub); if (!await users.deleteById(req.auth.sub)) throw notFound("User"); res.status(204).send(); }),
}; }
