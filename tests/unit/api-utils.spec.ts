import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { handleServiceError, getRequestContext } from '@/lib/api-utils';
import {
  ServiceError,
  ValidationError,
  AuthenticationError,
  AccountLockedError,
  NotFoundError,
} from '@/services/auth.errors';

// Mock the security module for role helper tests
vi.mock('@/lib/security/index', () => ({
  hasRole: vi.fn(),
  isGranted: vi.fn(),
  ROLES: {
    ADMIN: 'ROLE_ADMIN',
    MODERATOR: 'ROLE_MODERATOR',
    USER: 'ROLE_USER',
    OWNER: 'ROLE_OWNER',
    EDITOR: 'ROLE_EDITOR',
  },
}));

import { hasRole } from '@/lib/security/index';
import type { UserWithRoles } from '@/lib/security/index';

describe('API Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
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

  describe('Role Helper Functions', () => {
    const mockUser: UserWithRoles = {
      id: 'user-123',
      userRoles: [],
    };

    describe('requireAdmin', () => {
      it('returns true when user has platform-wide admin', async () => {
        const { requireAdmin } = await import('@/lib/api-utils');
        vi.mocked(hasRole).mockResolvedValue(true);

        const result = await requireAdmin(mockUser, null);

        expect(result).toBe(true);
        expect(hasRole).toHaveBeenCalledWith(mockUser, 'ROLE_ADMIN', null);
      });

      it('returns true when user has org-scoped admin', async () => {
        const { requireAdmin } = await import('@/lib/api-utils');
        vi.mocked(hasRole).mockResolvedValue(true);

        const result = await requireAdmin(mockUser, 'org-123');

        expect(result).toBe(true);
        expect(hasRole).toHaveBeenCalledWith(mockUser, 'ROLE_ADMIN', 'org-123');
      });

      it('returns false when user is not admin', async () => {
        const { requireAdmin } = await import('@/lib/api-utils');
        vi.mocked(hasRole).mockResolvedValue(false);

        const result = await requireAdmin(mockUser, 'org-123');

        expect(result).toBe(false);
      });

      it('returns false when user is null', async () => {
        const { requireAdmin } = await import('@/lib/api-utils');

        const result = await requireAdmin(null, 'org-123');

        expect(result).toBe(false);
        expect(hasRole).not.toHaveBeenCalled();
      });
    });

    describe('requireModerator', () => {
      it('returns true when user has moderator role', async () => {
        const { requireModerator } = await import('@/lib/api-utils');
        vi.mocked(hasRole).mockResolvedValue(true);

        const result = await requireModerator(mockUser, 'org-123');

        expect(result).toBe(true);
        expect(hasRole).toHaveBeenCalledWith(
          mockUser,
          'ROLE_MODERATOR',
          'org-123'
        );
      });

      it('returns true when user has platform-wide moderator', async () => {
        const { requireModerator } = await import('@/lib/api-utils');
        vi.mocked(hasRole).mockResolvedValue(true);

        const result = await requireModerator(mockUser, null);

        expect(result).toBe(true);
        expect(hasRole).toHaveBeenCalledWith(mockUser, 'ROLE_MODERATOR', null);
      });

      it('returns false when user is not moderator', async () => {
        const { requireModerator } = await import('@/lib/api-utils');
        vi.mocked(hasRole).mockResolvedValue(false);

        const result = await requireModerator(mockUser, 'org-123');

        expect(result).toBe(false);
      });

      it('returns false when user is null', async () => {
        const { requireModerator } = await import('@/lib/api-utils');

        const result = await requireModerator(null, 'org-123');

        expect(result).toBe(false);
        expect(hasRole).not.toHaveBeenCalled();
      });
    });
  });
});
