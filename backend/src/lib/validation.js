import { badRequest } from "./errors.js";

export function requireString(value, field, { min = 1, max = 500 } = {}) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw badRequest(`${field} must be between ${min} and ${max} characters`);
  return value.trim();
}
export function optionalString(value, field, options) { return value === undefined ? undefined : requireString(value, field, options); }
export function email(value) {
  const normalized = requireString(value, "email", { min: 3, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw badRequest("email must be a valid email address");
  return normalized;
}
export function password(value) {
  const valid = typeof value === "string" && value.length >= 12 && value.length <= 128;
  if (!valid) throw badRequest("password must be between 12 and 128 characters");
  return value;
}
export function userRole(value) {
  if (!["admin", "moderator", "user"].includes(value)) throw badRequest("role must be admin, moderator, or user");
  return value;
}
export function accountStatus(value) { if (!["active", "suspended"].includes(value)) throw badRequest("status must be active or suspended"); return value; }
export function projectStatus(value) {
  if (!["planned", "active", "archived"].includes(value)) throw badRequest("status must be planned, active, or archived");
  return value;
}
