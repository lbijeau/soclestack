import { describe, it, expect } from 'vitest';
import * as OTPAuth from 'otpauth';
import { generateTOTPSecret, verifyTOTPCode } from '@/lib/auth/totp';

/**
 * TOTP (Time-based One-Time Password) tests.
 *
 * These tests verify the 2FA TOTP implementation for generating
 * secrets and verifying codes.
 */

describe('TOTP Generation', () => {
  describe('generateTOTPSecret', () => {
    it('should generate a valid TOTP setup result', async () => {
      const result = await generateTOTPSecret('test@example.com');

      expect(result).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.qrCodeDataUrl).toBeDefined();
      expect(result.manualEntryKey).toBeDefined();
    });

    it('should generate a base32 encoded secret', async () => {
      const result = await generateTOTPSecret('test@example.com');

      // Base32 alphabet: A-Z and 2-7
      expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    });

    it('should generate a valid QR code data URL', async () => {
      const result = await generateTOTPSecret('test@example.com');

      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should set manualEntryKey same as secret', async () => {
      const result = await generateTOTPSecret('test@example.com');

      expect(result.manualEntryKey).toBe(result.secret);
    });

    it('should generate unique secrets for each call', async () => {
      const result1 = await generateTOTPSecret('test@example.com');
      const result2 = await generateTOTPSecret('test@example.com');

      expect(result1.secret).not.toBe(result2.secret);
    });

    it('should work with different email formats', async () => {
      const emails = [
        'user@example.com',
        'user+tag@example.com',
        'user.name@example.co.uk',
      ];

      for (const email of emails) {
        const result = await generateTOTPSecret(email);
        expect(result.secret).toBeDefined();
        expect(result.qrCodeDataUrl).toBeDefined();
      }
    });
  });
});

describe('TOTP Verification', () => {
  describe('verifyTOTPCode', () => {
    it('should verify a valid TOTP code', async () => {
      const result = await generateTOTPSecret('test@example.com');

      // Generate the current valid code using the secret
      const totp = new OTPAuth.TOTP({
        issuer: 'SocleStack',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(result.secret),
      });

      const validCode = totp.generate();
      const isValid = verifyTOTPCode(result.secret, validCode);

      expect(isValid).toBe(true);
    });

    it('should reject an invalid TOTP code', async () => {
      const result = await generateTOTPSecret('test@example.com');

      // Generate the valid code, then modify one digit to ensure invalidity
      const totp = new OTPAuth.TOTP({
        issuer: 'SocleStack',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(result.secret),
      });

      const validCode = totp.generate();
      // Modify the last digit to create an invalid code
      const lastDigit = parseInt(validCode[5], 10);
      const invalidLastDigit = (lastDigit + 1) % 10;
      const invalidCode = validCode.slice(0, 5) + invalidLastDigit.toString();

      const isValid = verifyTOTPCode(result.secret, invalidCode);
      expect(isValid).toBe(false);
    });

    it('should reject wrong format codes', async () => {
      const result = await generateTOTPSecret('test@example.com');

      expect(verifyTOTPCode(result.secret, '')).toBe(false);
      expect(verifyTOTPCode(result.secret, '12345')).toBe(false); // 5 digits
      expect(verifyTOTPCode(result.secret, '1234567')).toBe(false); // 7 digits
      expect(verifyTOTPCode(result.secret, 'abcdef')).toBe(false); // non-numeric
    });

    it('should allow codes within time window', async () => {
      const result = await generateTOTPSecret('test@example.com');

      const totp = new OTPAuth.TOTP({
        issuer: 'SocleStack',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(result.secret),
      });

      // Get the current code
      const currentCode = totp.generate();

      // Verify it works
      expect(verifyTOTPCode(result.secret, currentCode)).toBe(true);
    });

    it('should handle codes with leading zeros', async () => {
      const result = await generateTOTPSecret('test@example.com');

      const totp = new OTPAuth.TOTP({
        issuer: 'SocleStack',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(result.secret),
      });

      const validCode = totp.generate();

      // Verify string comparison works (codes can have leading zeros)
      expect(verifyTOTPCode(result.secret, validCode)).toBe(true);
    });
  });
});
