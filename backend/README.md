# MERN template API

A small, consistent API baseline for client projects. It includes invitation-based onboarding, verified email, password recovery, revocable sessions, account administration, and owner-scoped example resources.

## Setup

1. Copy `.env.example` to `.env`, use a unique, long `JWT_SECRET`, and set the initial `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
2. Start MongoDB.
3. Run `npm install` from `backend` and then `npm run dev`.

## Linux bootstrap and MongoDB indexes

`scripts/bootstrap-linux.sh` defaults the deployment database to `mern_template`; override it with `--mongo-database DATABASE`. After MongoDB is enabled and passes a health check, the script runs a generated initialization script with `mongosh`. It creates a dedicated application user with `readWrite` access only to that database and writes an authenticated, URL-encoded `MONGODB_URI` plus the matching `MONGODB_DB` to `/etc/mern-basic/bootstrap.env`.

The bootstrap script also derives `backend/.env` from `.env.example` for production. It supplies the authenticated database URI, matching database name, `NODE_ENV=production`, an internal backend port, `CLIENT_ORIGIN=https://<domain>`, a cryptographically strong JWT secret, and a generated initial administrator password. Normal reruns preserve the secrets. The initial login is stored in root-readable `/etc/mern-basic/secrets.env`; move it to your secret-management workflow after setup. `backend/.env` contains credentials, is readable only by root and the API service group, is ignored by Git, and **must never be committed**.

The initialization is idempotent: an existing database user is preserved, including its password. Use `--rotate-mongo-password` explicitly when changing that user's credentials.

The installer deliberately does not create application collections or indexes. On application startup, `backend/src/dao/index.js` calls `createIndexes()` for both `UsersDAO` and `ProjectsDAO`; this creates the unique `users.email` index and the `projects.ownerId/createdAt` index.

On every application startup, the configured administrator is created if absent and synchronized to the configured name, password, `admin` role, and verified status. Public registration is intentionally disabled; administrators invite accounts and select `admin`, `moderator`, or `user` access. Account-action links are handed to the vendor-neutral `createAccountEmailSender` seam. Replace its structured development logger with a transactional-email provider in production. `EXPOSE_ACCOUNT_TOKENS=true` returns preview links during local development only and is forcibly disabled in production.

Access tokens are intentionally short-lived and include a session identifier. Refresh tokens rotate on every use, are stored only as SHA-256 digests, and are delivered in Secure (in production), HTTP-only, SameSite=Strict cookies. Password changes revoke other sessions; password resets and suspension revoke all sessions. Configure `TERMS_VERSION` and/or `PRIVACY_VERSION` to require and record those versions when an invitation is accepted.

## API contract

All successful payloads are wrapped in `data`; list responses also return `meta`. Errors use `{ "error": { "code", "message", "details?" } }`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/auth/login`, `/refresh`, `/logout` | Start, rotate, or end a session |
| POST | `/api/v1/auth/invitations/accept` | Accept an emailed invitation and set a password |
| POST | `/api/v1/auth/email/verify`, `/email/resend` | Verify an address or request another link |
| POST | `/api/v1/auth/password/forgot`, `/password/reset` | Request and complete password recovery |
| PATCH | `/api/v1/auth/password` | Change the current password |
| GET/DELETE | `/api/v1/auth/sessions` | List sessions or revoke all other sessions |
| DELETE | `/api/v1/auth/sessions/:sessionId` | Revoke one session |
| GET/POST | `/api/v1/users` | List users or send an invitation (admin only) |
| PATCH/DELETE | `/api/v1/users/:userId` | Edit, suspend/reactivate, or remove an account (admin only) |
| GET/PATCH/DELETE | `/api/v1/users/me` | Current account |
| GET/POST | `/api/v1/projects` | Current user's projects |
| GET/PATCH/DELETE | `/api/v1/projects/:projectId` | A current user's project |

Send `Authorization: Bearer <accessToken>` to protected endpoints and allow credentials on refresh/logout requests. Passwords are salted and derived with Node's `scrypt`; password hashes and account/session token digests are never returned.

## Add a resource

Create a DAO that extends `BaseDAO`, a controller factory, and routes. Keep business/persistence logic out of Express handlers, validate input at the boundary, scope tenant-owned data in the DAO, return serialized public fields only, and add collection indexes in the DAO's `createIndexes` method.
