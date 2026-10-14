import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password.js";
import { signToken, verifyToken } from "../src/lib/jwt.js";
import { newOpaqueToken, tokenDigest } from "../src/lib/account-tokens.js";
import { refreshCookieOptions } from "../src/controllers/auth.controller.js";

const config = { jwtSecret: "test-secret-that-is-long-enough-to-be-safe", jwtExpiresIn: "1h" };

test("passwords are salted and verifiable", async () => {
  const hash = await hashPassword("a strong test password");
  assert.notEqual(hash, "a strong test password");
  assert.equal(await verifyPassword("a strong test password", hash), true);
  assert.equal(await verifyPassword("incorrect password", hash), false);
});

test("signed JWTs preserve claims and reject tampering", () => {
  const token = signToken({ userId: "user-123", role: "user", sessionId: "session-123" }, config);
  assert.deepEqual({ sub: verifyToken(token, config).sub, sid: verifyToken(token, config).sid }, { sub: "user-123", sid: "session-123" });
  assert.throws(() => verifyToken(`${token}x`, config), /Invalid access token/);
});

test("account action tokens are random and only persisted as stable digests", () => {
  const first = newOpaqueToken(); const second = newOpaqueToken();
  assert.notEqual(first, second); assert.equal(tokenDigest(first), tokenDigest(first)); assert.notEqual(tokenDigest(first), first);
});

test("refresh cookie options follow HTTP transport and session lifetime", () => {
  assert.deepEqual(refreshCookieOptions({ refreshCookieSecure: false, refreshExpiresSeconds: 60 }), {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: 60000,
  });
});

test("refresh cookie options support HTTPS and an explicit lifetime", () => {
  assert.deepEqual(refreshCookieOptions({ refreshCookieSecure: true, refreshExpiresSeconds: 60 }, 0), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: 0,
  });
});
