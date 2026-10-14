import { Router } from "express";
import { createAuthController } from "../controllers/auth.controller.js";
import { createProjectsController } from "../controllers/projects.controller.js";
import { createUsersController } from "../controllers/users.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/security.js";
import { createSessionsController } from "../controllers/sessions.controller.js";
import { createAccountEmailSender } from "../lib/account-email.js";

export function createApiRouter({ daos, config }) {
  const router = Router(); const auth = authenticate(config, daos); const sendAccountEmail = createAccountEmailSender(config);
  const authController = createAuthController({ ...daos, config, sendAccountEmail });
  const usersController = createUsersController({ ...daos, config, sendAccountEmail });
  const sessionsController = createSessionsController({ sessions: daos.sessions });
  const projectsController = createProjectsController({ projects: daos.projects });
  router.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));
  router.post("/auth/login", createRateLimiter({ max: 10 }), authController.login);
  router.post("/auth/refresh", createRateLimiter({ max: 30 }), authController.refresh);
  router.post("/auth/logout", authController.logout);
  router.post("/auth/password/forgot", createRateLimiter({ max: 5 }), authController.requestPasswordReset);
  router.post("/auth/password/reset", createRateLimiter({ max: 5 }), authController.resetPassword);
  router.post("/auth/email/verify", createRateLimiter({ max: 10 }), authController.verifyEmail);
  router.post("/auth/email/resend", createRateLimiter({ max: 5 }), authController.resendVerification);
  router.post("/auth/invitations/accept", createRateLimiter({ max: 10 }), authController.acceptInvitation);
  router.patch("/auth/password", auth, authController.changePassword);
  router.route("/auth/sessions").get(auth, sessionsController.list).delete(auth, sessionsController.revokeOthers);
  router.delete("/auth/sessions/:sessionId", auth, sessionsController.revoke);
  router.route("/users").get(auth, authorize("admin"), usersController.list).post(auth, authorize("admin"), createRateLimiter({ max: 20 }), usersController.invite);
  router.route("/users/me").get(auth, usersController.getMe).patch(auth, usersController.updateMe).delete(auth, usersController.deleteMe);
  router.route("/users/:userId").patch(auth, authorize("admin"), usersController.update).delete(auth, authorize("admin"), usersController.remove);
  router.route("/projects").get(auth, projectsController.list).post(auth, projectsController.create);
  router.route("/projects/:projectId").get(auth, projectsController.getById).patch(auth, projectsController.update).delete(auth, projectsController.remove);
  return router;
}
