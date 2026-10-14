import dotenv from "dotenv";

dotenv.config();

const required = ["MONGODB_URI", "MONGODB_DB", "JWT_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD"];

export function getConfig() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ADMIN_EMAIL)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (process.env.ADMIN_PASSWORD.length < 12 || process.env.ADMIN_PASSWORD.length > 128) {
    throw new Error("ADMIN_PASSWORD must be between 12 and 128 characters");
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
  const refreshCookieSecure = process.env.REFRESH_COOKIE_SECURE === undefined
    ? clientOrigin.split(",").every((origin) => origin.trim().startsWith("https://"))
    : process.env.REFRESH_COOKIE_SECURE === "true";

  return {
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 5000),
    host: process.env.HOST || "127.0.0.1",
    mongoUri: process.env.MONGODB_URI,
    mongoDatabase: process.env.MONGODB_DB,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
    refreshExpiresSeconds: Number(process.env.REFRESH_EXPIRES_SECONDS || 2592000),
    refreshCookieName: process.env.REFRESH_COOKIE_NAME || "refresh_session",
    refreshCookieSecure,
    invitationExpiresSeconds: Number(process.env.INVITATION_EXPIRES_SECONDS || 604800),
    verificationExpiresSeconds: Number(process.env.VERIFICATION_EXPIRES_SECONDS || 86400),
    resetExpiresSeconds: Number(process.env.RESET_EXPIRES_SECONDS || 3600),
    exposeAccountTokens: process.env.EXPOSE_ACCOUNT_TOKENS === "true" && process.env.NODE_ENV !== "production",
    termsVersion: process.env.TERMS_VERSION || "",
    privacyVersion: process.env.PRIVACY_VERSION || "",
    clientOrigin,
    adminName: process.env.ADMIN_NAME || "Administrator",
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
  };
}
