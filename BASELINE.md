# Web application baseline

`mern-basic` should be a reusable starting point, not a finished product. The
baseline should solve the repetitive, security-sensitive work that nearly every
client application needs while leaving domain-specific workflows to the project
built from it.

## Included today

- Bootstrap-provisioned administrator and administrator-managed user accounts.
- JWT sign-in and protected API routes.
- `admin`, `moderator`, and `user` roles with server-side authorization.
- Self-service profile read, update, and account deletion endpoints.
- Owner-scoped project CRUD as the example for tenant-safe resources.
- Validation, consistent API errors, pagination, rate limiting, CORS, security
  headers, password hashing, health checks, and MongoDB indexes.
- A React sign-in screen, dashboard, and administrator user-creation screen.
- Repeatable Ansible deployment with Nginx, systemd, MongoDB, firewall rules,
  encrypted secrets, and post-deployment health checks.

## Core product baseline

These are the next features that should be available before using the template
for most client work, in roughly this order.

### 1. Complete account lifecycle (included)

- Invite users by email instead of sharing temporary passwords manually.
- Verify email addresses and support expiring password-reset links.
- Let signed-in users change their password and terminate their other sessions.
- Use short-lived access tokens with rotating, revocable refresh sessions stored
  in secure, HTTP-only cookies.
- Allow administrators to suspend, reactivate, edit, and remove accounts.
- Record accepted terms/privacy-policy versions when a product requires consent.

### 2. Roles and permissions

- Keep authorization enforced by the API; hiding a frontend button is never the
  security boundary.
- Replace scattered role checks with named permissions such as `users.manage`
  and `projects.update` so each client can adjust roles without rewriting routes.
- Support an organization/workspace boundary when data can belong to a customer
  rather than one individual, including membership and invitation states.

### 3. Reusable application shell

- Add profile, password, and session settings screens.
- Provide accessible navigation, forms, dialogs, empty states, loading states,
  field-level errors, confirmation prompts, and success notifications.
- Include not-found, forbidden, offline, and unexpected-error pages plus an
  error boundary.
- Make list screens consistently support search, filtering, sorting, pagination,
  and responsive layouts.

### 4. Operations and accountability

- Store an audit trail for sign-ins and security- or data-sensitive changes,
  including actor, action, target, timestamp, and request correlation ID.
- Use structured logs, centralized error reporting, readiness/liveness checks,
  and basic metrics without logging tokens, passwords, or personal data.
- Add database backup and tested restore procedures, retention rules, migrations,
  and a rollback strategy.
- Provide separate development, test, staging, and production configuration with
  secret rotation and least-privilege credentials.

### 5. Security defaults

- Add CSRF protection when cookie authentication is introduced and keep strict
  origin, payload-size, and content-type policies.
- Apply endpoint-specific rate limits to login, invitations, password recovery,
  and other abuse-prone actions.
- Validate and normalize all input on the server, escape output for its context,
  and scan uploaded files if uploads are enabled.
- Automate dependency, secret, and static-analysis checks in CI, and document a
  security reporting and patching process.

### 6. Delivery quality

- Run formatting, linting, unit tests, API integration tests, frontend component
  tests, and a small browser smoke suite in continuous integration.
- Test authorization failures and cross-account data access, not only successful
  requests.
- Supply deterministic seed/factory data and one-command local startup.
- Include API documentation, environment-variable validation, release notes, and
  a deployment checklist.

## Add only when a client needs it

The template should provide integration seams and examples for these concerns,
but should not force vendors or product policy into every application:

- Transactional email and notification preferences.
- File/image uploads and object storage.
- Payments, subscriptions, invoices, and tax handling.
- Social or enterprise SSO and multi-factor authentication.
- Real-time updates, background jobs, scheduled work, and webhooks.
- Internationalization, multiple time zones, and locale-aware formatting.
- Data export/import, analytics, cookie consent, and jurisdiction-specific
  privacy workflows.
- Feature flags, impersonation, support tooling, and advanced moderation.

## Definition of ready

A capability belongs in the shared baseline when it is common across clients,
has a safe default, can be configured without editing business logic, includes
authorization and failure-path tests, is documented, and can be removed or
replaced without disrupting the rest of the application. Domain models, visual
branding, legal policy, and vendor choices should remain project decisions.
