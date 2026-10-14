import cors from "cors";
import express from "express";
import { createApiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler, securityHeaders } from "./middleware/security.js";

export function createApp({ daos, config }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(cors({ origin: config.clientOrigin.split(",").map((origin) => origin.trim()), credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"], allowedHeaders: ["Content-Type", "Authorization"] }));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/v1", createApiRouter({ daos, config }));
  app.use(notFoundHandler); app.use(errorHandler);
  return app;
}
