import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { handleServiceError, getRequestContext } from '@/lib/api-utils';
import {
  ServiceError,
  ValidationError,
  AuthenticationError,
  AccountLockedError,
  NotFoundError,
} from '@/services/auth.errors';

describe('API Utils', () => {
  describe('handleServiceError', () => {
    it('should handle ValidationError with status 400', async () => {
      const error = new ValidationError('Invalid input', {
        details: { email: ['Required'] },
      });

      const response = handleServiceError(error);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.type).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Invalid input');
      expect(body.error.details).toEqual({ email: ['Required'] });
    });

    it('should handle AuthenticationError with status 401', async () => {
      const error = new AuthenticationError('Invalid credentials');

      const response = handleServiceError(error);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.type).toBe('AUTHENTICATION_ERROR');
      expect(body.error.message).toBe('Invalid credentials');
    });

    it('should handle AccountLockedError with status 423', async () => {
      const lockedUntil = new Date('2024-01-01T12:00:00Z');
      const error = new AccountLockedError(lockedUntil, 3600);

      const response = handleServiceError(error);
      const body = await response.json();

      expect(response.status).toBe(423);
      expect(body.error.type).toBe('ACCOUNT_LOCKED');
      expect(body.error.lockedUntil).toBe(lockedUntil.toISOString());
      expect(body.error.retryAfterSeconds).toBe(3600);
    });

    it('should handle NotFoundError with status 404', async () => {
      const error = new NotFoundError('User not found');

      const response = handleServiceError(error);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.type).toBe('NOT_FOUND');
    });

    it('should handle generic ServiceError', async () => {
      const error = new ServiceError('CUSTOM_ERROR', 'Custom message', 418);

      const response = handleServiceError(error);
      const body = await response.json();

      expect(response.status).toBe(418);
      expect(body.error.type).toBe('CUSTOM_ERROR');
      expect(body.error.message).toBe('Custom message');
    });

    it('should handle unknown errors with status 500', async () => {
      const error = new Error('Something went wrong');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = handleServiceError(error);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.type).toBe('SERVER_ERROR');
      expect(body.error.message).toBe('An internal server error occurred');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle null/undefined errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = handleServiceError(null);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.type).toBe('SERVER_ERROR');

      consoleSpy.mockRestore();
    });
  });

  describe('getRequestContext', () => {
    it('should extract client IP and user agent from request', () => {
      const mockRequest = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1';
            if (name === 'user-agent') return 'Mozilla/5.0';
            return null;
          }),
        },
        ip: undefined,
      } as unknown as NextRequest;

      const context = getRequestContext(mockRequest);

      expect(context.clientIP).toBe('192.168.1.1');
      expect(context.userAgent).toBe('Mozilla/5.0');
    });

    it('should handle missing user agent', () => {
      const mockRequest = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '10.0.0.1';
            return null;
          }),
        },
        ip: undefined,
      } as unknown as NextRequest;

      const context = getRequestContext(mockRequest);

      expect(context.clientIP).toBe('10.0.0.1');
      expect(context.userAgent).toBeUndefined();
    });

    it('should fallback to unknown for missing IP', () => {
      const mockRequest = {
        headers: {
          get: vi.fn(() => null),
        },
        ip: undefined,
      } as unknown as NextRequest;

      const context = getRequestContext(mockRequest);

      expect(context.clientIP).toBe('unknown');
    });
  });
});
