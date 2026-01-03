/**
 * Auth Service Error Classes
 *
 * Typed errors thrown by auth service functions.
 * Route handlers catch these and map to HTTP responses.
 */

/**
 * Base service error with type, message, status code, and optional details.
 */
export class ServiceError extends Error {
  constructor(
    public readonly type: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Validation error - invalid input data (400)
 */
export class ValidationError extends ServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error - invalid credentials (401)
 */
export class AuthenticationError extends ServiceError {
  constructor(message = 'Invalid credentials') {
    super('AUTHENTICATION_ERROR', message, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error - not allowed to access resource (403)
 */
export class AuthorizationError extends ServiceError {
  constructor(message = 'Access denied') {
    super('AUTHORIZATION_ERROR', message, 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * Email not verified error (403)
 */
export class EmailNotVerifiedError extends ServiceError {
  constructor() {
    super(
      'AUTHORIZATION_ERROR',
      'Please verify your email before logging in',
      403
    );
    this.name = 'EmailNotVerifiedError';
  }
}

/**
 * Account locked error - too many failed attempts (423)
 */
export class AccountLockedError extends ServiceError {
  constructor(
    public readonly lockedUntil: Date | null,
    public readonly retryAfterSeconds: number
  ) {
    super(
      'ACCOUNT_LOCKED',
      'Account temporarily locked due to too many failed attempts',
      423,
      {
        lockedUntil: lockedUntil?.toISOString() ?? null,
        retryAfterSeconds,
      }
    );
    this.name = 'AccountLockedError';
  }
}

/**
 * Rate limit error - too many requests (429)
 */
export class RateLimitError extends ServiceError {
  constructor(message = 'Too many attempts. Please try again later.') {
    super('AUTHORIZATION_ERROR', message, 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Token expired error - for password reset, email verification, etc. (401)
 */
export class TokenExpiredError extends ServiceError {
  constructor(message = 'Token has expired') {
    super('TOKEN_EXPIRED', message, 401);
    this.name = 'TokenExpiredError';
  }
}

/**
 * Token invalid error - malformed or not found (401)
 */
export class TokenInvalidError extends ServiceError {
  constructor(message = 'Invalid token') {
    super('TOKEN_INVALID', message, 401);
    this.name = 'TokenInvalidError';
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends ServiceError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error - resource already exists (409)
 */
export class ConflictError extends ServiceError {
  constructor(message = 'Resource already exists') {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}
