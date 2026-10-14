# Instructions for synchronizing improvements back to `mern-basic`

Use this document as the implementation brief in the separate `mern-basic`
repository. It deliberately describes only reusable template behavior. Do not
copy TERB customers, inventory, point-of-sale, bookkeeping, deals, branding, or
other product-specific code.

## Goal

Keep users signed in after a page reload by using the existing rotating refresh
session, including on installations made with the template's HTTP-only Nginx
deployment. Preserve the secure default when the application is actually served
over HTTPS, and repair older deployments when the rebuild playbook runs.

The access token must remain short-lived and in React memory. Do **not** solve
persistence by placing access or refresh tokens in `localStorage` or
`sessionStorage`. The refresh token remains an opaque, rotating token in an
HTTP-only cookie and only its digest is stored in MongoDB.

## Required implementation

### 1. Make refresh-cookie transport security explicit

In `backend/src/config/env.js`:

1. Read `CLIENT_ORIGIN` once, retaining the existing local-development default.
2. Add `REFRESH_COOKIE_SECURE` to the resulting configuration as a boolean.
3. When the variable is absent, infer the value from `CLIENT_ORIGIN`: it is
   `true` only when every comma-separated allowed origin starts with `https://`.
4. When it is present, use strict string parsing: only the value `true` enables
   the Secure flag.

This setting must describe the browser-facing transport. It must not be derived
from `NODE_ENV`; a production process can legitimately be exposed by the
bundled HTTP-only Nginx site, and browsers will not return a Secure cookie over
that connection.

Document the optional variable in `backend/.env.example`, including the HTTPS
inference and the fact that it should normally only be overridden when TLS
termination makes the inferred value inaccurate.

### 2. Use one cookie policy for login, rotation, and logout

In `backend/src/controllers/auth.controller.js`, create a small exported helper
that returns the refresh-cookie options:

- `httpOnly: true`
- `secure: config.refreshCookieSecure`
- `sameSite: "strict"`
- `path: "/api/v1/auth"`
- `maxAge: config.refreshExpiresSeconds * 1000` (or an explicitly supplied
  override)

Use the helper every time the refresh cookie is created, rotated, or cleared.
Logout should clear it by writing an empty value with a zero `maxAge`, using the
same path and security policy. Keeping the cookie path identical is important;
otherwise the browser may retain the original cookie.

Do not weaken the surrounding session design. Login creates a server-side
session, refresh rotates the opaque token atomically, logout revokes its session,
password reset revokes all sessions, and password change revokes the other
sessions.

### 3. Preserve the frontend refresh flow

Confirm that the base repository still has all of these behaviors:

- Every API `fetch` uses `credentials: "include"`.
- The access token is held in the authentication provider's in-memory state.
- On provider mount, the frontend calls `POST /auth/refresh` before deciding
  whether the visitor is signed out, and exposes a loading state during that
  check. This is what restores the login after a reload.
- A non-authentication request that receives `401` performs one refresh and then
  retries once.
- Concurrent `401` responses share one in-flight refresh promise so rotating
  the same token is not attempted multiple times.
- A failed refresh clears frontend authentication state.

If these features are already present in `mern-basic`, retain them rather than
rewriting them. They are listed here as acceptance requirements because the
cookie fix alone cannot provide login persistence without them.

### 4. Match the bundled Ansible deployment to its actual protocol

The Nginx configuration shipped by the template serves HTTP, not HTTPS.
Therefore, in
`ansible/roles/application/templates/backend.env.j2`:

- render `CLIENT_ORIGIN=http://localhost` for a local-only install;
- render `CLIENT_ORIGIN=http://<configured-domain-or-IP>` for a network install;
- render `REFRESH_COOKIE_SECURE=false` for both cases.

Add a comment explaining that browsers reject Secure cookies on this HTTP site.
Do not advertise an `https://` origin unless the playbooks also provision TLS.
When an operator adds TLS externally, the documented production action is to
set the public HTTPS `CLIENT_ORIGIN` and `REFRESH_COOKIE_SECURE=true`.

### 5. Repair existing installations during rebuild

The rebuild currently preserves the deployed `backend/.env` to protect secrets.
That also preserves obsolete transport settings, so source changes alone will
not fix an existing host.

After source synchronization and before dependency installation/restart, add
idempotent `ansible.builtin.lineinfile` tasks in
`ansible/roles/application/tasks/rebuild.yml` that:

1. replace `CLIENT_ORIGIN` with the HTTP origin matching the current local-only
   and domain settings; and
2. replace or insert `REFRESH_COOKIE_SECURE=false` immediately after
   `CLIENT_ORIGIN`.

Use `create: false`: rebuild must continue to require an existing deployment,
not silently manufacture an incomplete environment file. Do not replace the
whole file or overwrite database, JWT, or administrator credentials.

Update the root deployment documentation to explain both the reconciliation on
rebuild and the HTTP-versus-HTTPS cookie configuration.

## Tests and acceptance criteria

Add or retain automated checks for the cookie-options helper:

- an HTTP configuration yields `secure: false`;
- an HTTPS configuration yields `secure: true`;
- the default lifetime is converted from seconds to milliseconds;
- the cookie remains HTTP-only, SameSite Strict, and scoped to
  `/api/v1/auth`.

Run the repository's backend tests and frontend tests. If Ansible is available,
run the site and rebuild playbook syntax checks as well.

Perform this browser smoke test against an HTTP deployment:

1. sign in successfully;
2. verify a `refresh_session` cookie exists and is HTTP-only but not Secure;
3. reload the page and verify the authenticated screen returns;
4. allow or simulate access-token expiry and verify one refresh succeeds;
5. sign out, reload, and verify the authenticated screen does not return.

Repeat the relevant cookie check in an HTTPS environment and require the Secure
flag there.

## Source-of-truth TERB changes

For a repository with shared Git ancestry, the reusable changes were introduced
by these TERB commits, in order:

1. `6c05fbc` — configuration-driven cookie security and its unit test;
2. `adbafc4` — correct HTTP origin/cookie values in the Ansible template; and
3. `1a7b15c` — rebuild-time reconciliation for already deployed environments.

Use the requirements above as the source of truth and adapt them to the current
`mern-basic` tree rather than blindly cherry-picking. This avoids importing TERB
business features or overwriting improvements that may have independently
landed in the template.
