import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateSessionToken,
  hashSessionToken,
  generateResetToken,
  hashResetToken,
  generateCSRFToken,
  createRateLimitKey,
  sanitizeInput,
  timeSafeEqual,
} from '@/lib/security';

/**
 * Security utilities tests.
 *
 * These tests verify the core security functions used throughout the application
 * for password hashing, JWT tokens, session management, and input sanitization.
 */

describe('Password Hashing', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for the same password (due to salt)', async () => {
      const password = 'SecurePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce bcrypt format hash', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      // bcrypt hashes start with $2a$ or $2b$
      expect(hash).toMatch(/^\$2[ab]\$/);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'SecurePassword123!';
      const wrongPassword = 'WrongPassword456!';
      const hash = await hashPassword(password);

      const result = await verifyPassword(wrongPassword, hash);
      expect(result).toBe(false);
    });

    it('should return false for empty password', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      const result = await verifyPassword('', hash);
      expect(result).toBe(false);
    });

    it('should handle special characters in password', async () => {
      const password = 'P@$$w0rd!#$%^&*()';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should handle unicode characters in password', async () => {
      const password = 'Pässwörd123!';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });
  });
});

describe('JWT Token Generation and Verification', () => {
  const testPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'USER' as const,
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT token', async () => {
      const token = await generateAccessToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // JWT format: header.payload.signature
      expect(token.split('.')).toHaveLength(3);
    });

    it('should generate unique tokens for same payload', async () => {
      const token1 = await generateAccessToken(testPayload);
      const token2 = await generateAccessToken(testPayload);

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', async () => {
      const token = await generateAccessToken(testPayload);
      const payload = await verifyAccessToken(token);

      expect(payload.sub).toBe(testPayload.userId);
      expect(payload.email).toBe(testPayload.email);
      expect(payload.role).toBe(testPayload.role);
    });

    it('should include jti (JWT ID) in payload', async () => {
      const token = await generateAccessToken(testPayload);
      const payload = await verifyAccessToken(token);

      expect(payload.jti).toBeDefined();
      expect(typeof payload.jti).toBe('string');
    });

    it('should include iat (issued at) in payload', async () => {
      const token = await generateAccessToken(testPayload);
      const payload = await verifyAccessToken(token);

      expect(payload.iat).toBeDefined();
      expect(typeof payload.iat).toBe('number');
    });

    it('should include exp (expiration) in payload', async () => {
      const token = await generateAccessToken(testPayload);
      const payload = await verifyAccessToken(token);

      expect(payload.exp).toBeDefined();
      expect(typeof payload.exp).toBe('number');
      // Token should expire in the future
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    // Note: Testing expired token rejection requires time mocking or waiting.
    // Expired token behavior is covered by integration/e2e tests.

    it('should throw for invalid token', async () => {
      await expect(verifyAccessToken('invalid-token')).rejects.toThrow(
        'Invalid access token'
      );
    });

    it('should throw for tampered token', async () => {
      const token = await generateAccessToken(testPayload);
      const tamperedToken = token.slice(0, -5) + 'XXXXX';

      await expect(verifyAccessToken(tamperedToken)).rejects.toThrow(
        'Invalid access token'
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', async () => {
      const token = await generateRefreshToken({ userId: 'user-123' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', async () => {
      const token = await generateRefreshToken({ userId: 'user-123' });
      const payload = await verifyRefreshToken(token);

      expect(payload.sub).toBe('user-123');
      expect(payload.jti).toBeDefined();
    });

    it('should throw for invalid refresh token', async () => {
      await expect(verifyRefreshToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should not accept access token as refresh token', async () => {
      const accessToken = await generateAccessToken(testPayload);

      await expect(verifyRefreshToken(accessToken)).rejects.toThrow(
        'Invalid refresh token'
      );
    });
  });
});

describe('Session Token Utilities', () => {
  describe('generateSessionToken', () => {
    it('should generate a 64-character hex string', async () => {
      const token = await generateSessionToken();

      expect(token).toBeDefined();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique tokens', async () => {
      const token1 = await generateSessionToken();
      const token2 = await generateSessionToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('hashSessionToken', () => {
    it('should hash a session token', async () => {
      const token = await generateSessionToken();
      const hash = await hashSessionToken(token);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(token);
      // SHA-256 produces 64 hex characters
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should produce consistent hash for same token', async () => {
      const token = 'test-session-token';
      const hash1 = await hashSessionToken(token);
      const hash2 = await hashSessionToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', async () => {
      const hash1 = await hashSessionToken('token1');
      const hash2 = await hashSessionToken('token2');

      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('Reset Token Utilities', () => {
  describe('generateResetToken', () => {
    it('should generate a 64-character hex string', async () => {
      const token = await generateResetToken();

      expect(token).toBeDefined();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique tokens', async () => {
      const token1 = await generateResetToken();
      const token2 = await generateResetToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('hashResetToken', () => {
    it('should hash a reset token', async () => {
      const token = await generateResetToken();
      const hash = await hashResetToken(token);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(token);
      expect(hash).toHaveLength(64);
    });

    it('should produce consistent hash for same token', async () => {
      const token = 'test-reset-token';
      const hash1 = await hashResetToken(token);
      const hash2 = await hashResetToken(token);

      expect(hash1).toBe(hash2);
    });
  });
});

describe('CSRF Token Utilities', () => {
  describe('generateCSRFToken', () => {
    it('should generate a 64-character hex string', async () => {
      const token = await generateCSRFToken();

      expect(token).toBeDefined();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique tokens', async () => {
      const token1 = await generateCSRFToken();
      const token2 = await generateCSRFToken();

      expect(token1).not.toBe(token2);
    });
  });
});

describe('Rate Limiting Utilities', () => {
  describe('createRateLimitKey', () => {
    it('should create a properly formatted key', () => {
      const key = createRateLimitKey('user-123', '/api/login');

      expect(key).toBe('rate_limit:user-123:/api/login');
    });

    it('should handle different identifiers', () => {
      const key1 = createRateLimitKey('192.168.1.1', '/api/login');
      const key2 = createRateLimitKey('user@example.com', '/api/register');

      expect(key1).toBe('rate_limit:192.168.1.1:/api/login');
      expect(key2).toBe('rate_limit:user@example.com:/api/register');
    });
  });
});

describe('Input Sanitization', () => {
  describe('sanitizeInput', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput(input);

      expect(sanitized).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape ampersand', () => {
      const input = 'Tom & Jerry';
      const sanitized = sanitizeInput(input);

      expect(sanitized).toBe('Tom &amp; Jerry');
    });

    it('should escape single quotes', () => {
      const input = "It's working";
      const sanitized = sanitizeInput(input);

      expect(sanitized).toBe('It&#x27;s working');
    });

    it('should escape double quotes', () => {
      const input = 'He said "hello"';
      const sanitized = sanitizeInput(input);

      expect(sanitized).toBe('He said &quot;hello&quot;');
    });

    it('should trim whitespace', () => {
      const input = '  hello world  ';
      const sanitized = sanitizeInput(input);

      expect(sanitized).toBe('hello world');
    });

    it('should handle empty string', () => {
      const sanitized = sanitizeInput('');
      expect(sanitized).toBe('');
    });

    it('should preserve safe characters', () => {
      const input = 'Hello World 123 !@#$%^*()_+-=[]{}|;:,./? ';
      const sanitized = sanitizeInput(input);

      // Only < > & " ' should be escaped
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('&');
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain("'");
    });
  });
});

describe('Time-Safe String Comparison', () => {
  describe('timeSafeEqual', () => {
    it('should return true for equal strings', () => {
      expect(timeSafeEqual('hello', 'hello')).toBe(true);
      expect(timeSafeEqual('abc123', 'abc123')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(timeSafeEqual('hello', 'world')).toBe(false);
      expect(timeSafeEqual('abc', 'abd')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(timeSafeEqual('short', 'longer')).toBe(false);
      expect(timeSafeEqual('abc', 'abcd')).toBe(false);
    });

    it('should return true for empty strings', () => {
      expect(timeSafeEqual('', '')).toBe(true);
    });

    it('should handle special characters', () => {
      expect(timeSafeEqual('p@$$w0rd!', 'p@$$w0rd!')).toBe(true);
      expect(timeSafeEqual('p@$$w0rd!', 'p@$$w0rd?')).toBe(false);
    });

    it('should handle unicode characters', () => {
      expect(timeSafeEqual('héllo', 'héllo')).toBe(true);
      expect(timeSafeEqual('héllo', 'hello')).toBe(false);
    });
  });
});
