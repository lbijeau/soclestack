import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ServiceError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  AccountLockedError,
  EmailNotVerifiedError,
  RateLimitError,
  TokenExpiredError,
  TokenInvalidError,
  NotFoundError,
  ConflictError,
} from '@/services/auth.errors';

describe('Auth Service Error Classes', () => {
  describe('ServiceError', () => {
    it('should create a ServiceError with correct properties', () => {
      const error = new ServiceError('TEST_ERROR', 'Test message', 500);

      expect(error.type).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('ServiceError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should include details when provided', () => {
      const details = { field: 'email', reason: 'invalid' };
      const error = new ServiceError('TEST_ERROR', 'Test message', 400, details);

      expect(error.details).toEqual(details);
    });

    it('should default to status 500 when not specified', () => {
      const error = new ServiceError('TEST_ERROR', 'Test message');

      expect(error.statusCode).toBe(500);
    });
  });

  describe('ValidationError', () => {
    it('should create with status 400', () => {
      const error = new ValidationError('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.type).toBe('VALIDATION_ERROR');
    });

    it('should include field errors in details', () => {
      const error = new ValidationError('Invalid input', {
        details: { email: ['Invalid email format'] },
      });

      expect(error.details).toEqual({ details: { email: ['Invalid email format'] } });
    });
  });

  describe('AuthenticationError', () => {
    it('should create with status 401', () => {
      const error = new AuthenticationError('Invalid credentials');

      expect(error.statusCode).toBe(401);
      expect(error.type).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('AuthorizationError', () => {
    it('should create with status 403', () => {
      const error = new AuthorizationError('Access denied');

      expect(error.statusCode).toBe(403);
      expect(error.type).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('AccountLockedError', () => {
    it('should create with status 423 and lock details', () => {
      const lockedUntil = new Date('2024-01-01T12:00:00Z');
      const error = new AccountLockedError(lockedUntil, 3600);

      expect(error.statusCode).toBe(423);
      expect(error.type).toBe('ACCOUNT_LOCKED');
      expect(error.details).toEqual({
        lockedUntil: lockedUntil.toISOString(),
        retryAfterSeconds: 3600,
      });
    });

    it('should handle null lockedUntil', () => {
      const error = new AccountLockedError(null, 3600);

      expect(error.details).toEqual({
        lockedUntil: null,
        retryAfterSeconds: 3600,
      });
    });
  });

  describe('EmailNotVerifiedError', () => {
    it('should create with status 403', () => {
      const error = new EmailNotVerifiedError();

      expect(error.statusCode).toBe(403);
      expect(error.type).toBe('EMAIL_NOT_VERIFIED');
      expect(error.message).toBe('Please verify your email before logging in');
    });
  });

  describe('RateLimitError', () => {
    it('should create with status 429', () => {
      const error = new RateLimitError('Too many requests');

      expect(error.statusCode).toBe(429);
      expect(error.type).toBe('RATE_LIMIT_ERROR');
    });
  });

  describe('TokenExpiredError', () => {
    it('should create with status 401', () => {
      const error = new TokenExpiredError('Token has expired');

      expect(error.statusCode).toBe(401);
      expect(error.type).toBe('TOKEN_EXPIRED');
    });
  });

  describe('TokenInvalidError', () => {
    it('should create with status 401', () => {
      const error = new TokenInvalidError('Token is invalid');

      expect(error.statusCode).toBe(401);
      expect(error.type).toBe('TOKEN_INVALID');
    });
  });

  describe('NotFoundError', () => {
    it('should create with status 404', () => {
      const error = new NotFoundError('User not found');

      expect(error.statusCode).toBe(404);
      expect(error.type).toBe('NOT_FOUND');
    });
  });

  describe('ConflictError', () => {
    it('should create with status 409', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.statusCode).toBe(409);
      expect(error.type).toBe('CONFLICT');
    });
  });

  describe('Error inheritance', () => {
    it('all error types should be instances of ServiceError', () => {
      expect(new ValidationError('test')).toBeInstanceOf(ServiceError);
      expect(new AuthenticationError('test')).toBeInstanceOf(ServiceError);
      expect(new AuthorizationError('test')).toBeInstanceOf(ServiceError);
      expect(new AccountLockedError(null, 0)).toBeInstanceOf(ServiceError);
      expect(new EmailNotVerifiedError()).toBeInstanceOf(ServiceError);
      expect(new RateLimitError('test')).toBeInstanceOf(ServiceError);
      expect(new TokenExpiredError('test')).toBeInstanceOf(ServiceError);
      expect(new TokenInvalidError('test')).toBeInstanceOf(ServiceError);
      expect(new NotFoundError('test')).toBeInstanceOf(ServiceError);
      expect(new ConflictError('test')).toBeInstanceOf(ServiceError);
    });

    it('all error types should be instances of Error', () => {
      expect(new ValidationError('test')).toBeInstanceOf(Error);
      expect(new AuthenticationError('test')).toBeInstanceOf(Error);
    });
  });
});
