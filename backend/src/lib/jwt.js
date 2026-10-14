import { createHmac, timingSafeEqual } from "node:crypto";
import { unauthorized } from "./errors.js";

const base64url = (value) => Buffer.from(value).toString("base64url");
const fromBase64url = (value) => Buffer.from(value, "base64url").toString("utf8");

function expiresInSeconds(value) {
  const match = /^(\d+)([smhd])?$/.exec(value);
  if (!match) throw new Error("JWT_EXPIRES_IN must be a number followed by s, m, h, or d");
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * (multipliers[match[2] || "s"] || 1);
}
function signature(input, secret) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function signToken({ userId, role, sessionId }, config) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, role, sid: sessionId, iat: now, exp: now + expiresInSeconds(config.jwtExpiresIn) };
  const input = `${base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64url(JSON.stringify(payload))}`;
  return `${input}.${signature(input, config.jwtSecret)}`;
}

export function verifyToken(token, config) {
  const [encodedHeader, encodedPayload, receivedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !receivedSignature) throw unauthorized("Invalid access token");
  const input = `${encodedHeader}.${encodedPayload}`;
  const expected = Buffer.from(signature(input, config.jwtSecret));
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw unauthorized("Invalid access token");
  const header = JSON.parse(fromBase64url(encodedHeader));
  const payload = JSON.parse(fromBase64url(encodedPayload));
  if (header.alg !== "HS256" || !payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) throw unauthorized("Access token has expired or is invalid");
  return payload;
}
