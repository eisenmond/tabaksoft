import { createHash, randomBytes } from "node:crypto";

export const newOpaqueToken = () => randomBytes(32).toString("base64url");
export const tokenDigest = (token) => createHash("sha256").update(token).digest("hex");
