import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ApiKeyPermission } from '@prisma/client';

// Use vi.hoisted to define mocks that will be used in vi.mock factories
const { mockValidateApiKey, mockIsMethodAllowed } = vi.hoisted(() => ({
  mockValidateApiKey: vi.fn(),
  mockIsMethodAllowed: vi.fn(),
}));

// Mock the dependencies before imports
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    apiKey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/api-keys', () => ({
  validateApiKey: mockValidateApiKey,
  isMethodAllowed: mockIsMethodAllowed,
}));

vi.mock('iron-session', () => ({
  getIronSession: vi.fn().mockResolvedValue({
    isLoggedIn: false,
    userId: '',
  }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(new Map()),
}));

// Now import the modules under test
import {
  getAuthContext,
  requireAuth,
  getUserFromContext,
  type AuthContext,
  type ApiKeyAuthContext,
  type SessionAuthContext,
} from '@/lib/auth';

describe('API Key Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to allowing methods
    mockIsMethodAllowed.mockReturnValue(true);
  });

  describe('getUserFromContext', () => {
    it('should extract user from session auth context', () => {
      const sessionContext: SessionAuthContext = {
        type: 'session',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'ROLE_USER',
          organizationId: 'org-123',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          password: 'hashed',
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          passwordChangedAt: null,
          lastLoginAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          twoFactorSecret: null,
          twoFactorEnabled: false,
          backupCodes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const user = getUserFromContext(sessionContext);

      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('ROLE_USER');
      expect(user.organizationId).toBe('org-123');
    });

    it('should extract user from API key auth context', () => {
      const apiKeyContext: ApiKeyAuthContext = {
        type: 'api_key',
        apiKeyId: 'key-123',
        permission: ApiKeyPermission.READ_WRITE,
        user: {
          id: 'user-456',
          email: 'api@example.com',
          role: 'ADMIN',
          isActive: true,
          organizationId: 'org-456',
        },
      };

      const user = getUserFromContext(apiKeyContext);

      expect(user.id).toBe('user-456');
      expect(user.email).toBe('api@example.com');
      expect(user.role).toBe('ADMIN');
      expect(user.organizationId).toBe('org-456');
    });
  });

  describe('getAuthContext', () => {
    it('should authenticate with valid API key', async () => {
      const mockRequest = new NextRequest('http://localhost/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer lsk_validapikey123456789012345678901234',
        },
      });

      mockValidateApiKey.mockResolvedValue({
        valid: true,
        apiKey: {
          id: 'key-123',
          permission: ApiKeyPermission.READ_WRITE,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'USER',
            isActive: true,
            organizationId: null,
          },
        },
      });

      mockIsMethodAllowed.mockReturnValue(true);

      const result = await getAuthContext(mockRequest);

      expect(result.context).not.toBeNull();
      expect(result.context?.type).toBe('api_key');
      expect((result.context as ApiKeyAuthContext).apiKeyId).toBe('key-123');
    });

    it('should reject invalid API key', async () => {
      const mockRequest = new NextRequest('http://localhost/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer lsk_invalidkey12345678901234567890123',
        },
      });

      mockValidateApiKey.mockResolvedValue({
        valid: false,
        error: 'Invalid API key',
      });

      const result = await getAuthContext(mockRequest);

      expect(result.context).toBeNull();
      expect(result.error).toBe('Invalid API key');
      expect(result.status).toBe(401);
    });

    it('should reject API key with insufficient permissions', async () => {
      const mockRequest = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: {
          authorization: 'Bearer lsk_validapikey123456789012345678901234',
        },
      });

      mockValidateApiKey.mockResolvedValue({
        valid: true,
        apiKey: {
          id: 'key-123',
          permission: ApiKeyPermission.READ_ONLY,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'USER',
            isActive: true,
            organizationId: null,
          },
        },
      });

      mockIsMethodAllowed.mockReturnValue(false);

      const result = await getAuthContext(mockRequest);

      expect(result.context).toBeNull();
      expect(result.error).toBe(
        'This API key does not have permission for this operation'
      );
      expect(result.status).toBe(403);
    });

    it('should fall back to session auth when no API key header', async () => {
      const mockRequest = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      });

      // No API key, no session
      const result = await getAuthContext(mockRequest);

      expect(result.context).toBeNull();
      expect(result.error).toBe('Not authenticated');
      expect(result.status).toBe(401);
    });
  });

  describe('requireAuth', () => {
    it('should return success with valid API key', async () => {
      const mockRequest = new NextRequest('http://localhost/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer lsk_validapikey123456789012345678901234',
        },
      });

      mockValidateApiKey.mockResolvedValue({
        valid: true,
        apiKey: {
          id: 'key-123',
          permission: ApiKeyPermission.READ_WRITE,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'ADMIN',
            isActive: true,
            organizationId: 'org-123',
          },
        },
      });

      mockIsMethodAllowed.mockReturnValue(true);

      const result = await requireAuth(mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.id).toBe('user-123');
        expect(result.user.email).toBe('test@example.com');
        expect(result.user.role).toBe('ADMIN');
        expect(result.context.type).toBe('api_key');
      }
    });

    it('should return failure when not authenticated', async () => {
      const mockRequest = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      });

      const result = await requireAuth(mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Not authenticated');
        expect(result.status).toBe(401);
      }
    });

    it('should return failure for invalid API key', async () => {
      const mockRequest = new NextRequest('http://localhost/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer lsk_badkey123456789012345678901234567',
        },
      });

      mockValidateApiKey.mockResolvedValue({
        valid: false,
        error: 'API key has expired',
      });

      const result = await requireAuth(mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('API key has expired');
        expect(result.status).toBe(401);
      }
    });

    it('should return failure for API key belonging to deactivated user', async () => {
      const mockRequest = new NextRequest('http://localhost/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer lsk_deactivateduser12345678901234567',
        },
      });

      mockValidateApiKey.mockResolvedValue({
        valid: false,
        error: 'User account is not active',
      });

      const result = await requireAuth(mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('User account is not active');
        expect(result.status).toBe(401);
      }
    });

    it('should return failure for revoked API key', async () => {
      const mockRequest = new NextRequest('http://localhost/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer lsk_revokedkey123456789012345678901',
        },
      });

      mockValidateApiKey.mockResolvedValue({
        valid: false,
        error: 'API key has been revoked',
      });

      const result = await requireAuth(mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('API key has been revoked');
        expect(result.status).toBe(401);
      }
    });
  });
});

