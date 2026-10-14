export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, "VALIDATION_ERROR", message, details);
export const unauthorized = (message = "Authentication is required") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You do not have permission to perform this action") => new AppError(403, "FORBIDDEN", message);
export const notFound = (resource = "Resource") => new AppError(404, "NOT_FOUND", `${resource} was not found`);
export const conflict = (message) => new AppError(409, "CONFLICT", message);
export const gone = (message) => new AppError(410, "TOKEN_EXPIRED", message);
