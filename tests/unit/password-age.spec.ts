import { describe, it, expect } from 'vitest';
import { checkPasswordAge } from '@/lib/auth/password-age';
import { SECURITY_CONFIG } from '@/lib/config/security';

/**
 * Password Age tests.
 *
 * These tests verify the password age checking logic that determines
 * when passwords need to be changed based on security policy.
 */

describe('Password Age Checking', () => {
  const { maxAgeDays, warningDays } = SECURITY_CONFIG.passwordPolicy;
  const msPerDay = 24 * 60 * 60 * 1000;

  describe('checkPasswordAge', () => {
    it('should return expired status for null passwordChangedAt', () => {
      const result = checkPasswordAge(null);

      expect(result.isExpired).toBe(true);
      expect(result.isWarning).toBe(true);
      expect(result.daysUntilExpiry).toBe(0);
      expect(result.daysSinceChange).toBe(maxAgeDays + 1);
    });

    it('should return not expired for recently changed password', () => {
      const passwordChangedAt = new Date(); // Just changed

      const result = checkPasswordAge(passwordChangedAt);

      expect(result.isExpired).toBe(false);
      expect(result.isWarning).toBe(false);
      expect(result.daysSinceChange).toBe(0);
      expect(result.daysUntilExpiry).toBe(maxAgeDays);
    });

    it('should return expired for password older than maxAgeDays', () => {
      const daysAgo = maxAgeDays + 1;
      const passwordChangedAt = new Date(Date.now() - daysAgo * msPerDay);

      const result = checkPasswordAge(passwordChangedAt);

      expect(result.isExpired).toBe(true);
      expect(result.daysUntilExpiry).toBe(0);
    });

    it('should return warning status when within warningDays of expiry', () => {
      // Password changed (maxAgeDays - warningDays + 1) days ago
      // This puts us just inside the warning window
      const daysAgo = maxAgeDays - warningDays + 1;
      const passwordChangedAt = new Date(Date.now() - daysAgo * msPerDay);

      const result = checkPasswordAge(passwordChangedAt);

      expect(result.isExpired).toBe(false);
      expect(result.isWarning).toBe(true);
      expect(result.daysUntilExpiry).toBeLessThanOrEqual(warningDays);
      expect(result.daysUntilExpiry).toBeGreaterThan(0);
    });

    it('should not show warning when not in warning window', () => {
      // Password changed 10 days ago - well before warning window
      const daysAgo = 10;
      const passwordChangedAt = new Date(Date.now() - daysAgo * msPerDay);

      const result = checkPasswordAge(passwordChangedAt);

      expect(result.isExpired).toBe(false);
      expect(result.isWarning).toBe(false);
      expect(result.daysUntilExpiry).toBeGreaterThan(warningDays);
    });

    it('should correctly calculate daysSinceChange', () => {
      const daysAgo = 30;
      const passwordChangedAt = new Date(Date.now() - daysAgo * msPerDay);

      const result = checkPasswordAge(passwordChangedAt);

      expect(result.daysSinceChange).toBe(daysAgo);
    });

    it('should correctly calculate daysUntilExpiry', () => {
      const daysAgo = 30;
      const passwordChangedAt = new Date(Date.now() - daysAgo * msPerDay);

      const result = checkPasswordAge(passwordChangedAt);

      expect(result.daysUntilExpiry).toBe(maxAgeDays - daysAgo);
    });

    it('should return 0 for daysUntilExpiry when expired', () => {
      const daysAgo = maxAgeDays + 10;
      const passwordChangedAt = new Date(Date.now() - daysAgo * msPerDay);

      const result = checkPasswordAge(passwordChangedAt);

      expect(result.daysUntilExpiry).toBe(0);
    });

    it('should handle exact expiry boundary', () => {
      // Password changed exactly maxAgeDays ago
      const passwordChangedAt = new Date(Date.now() - maxAgeDays * msPerDay);

      const result = checkPasswordAge(passwordChangedAt);

      expect(result.isExpired).toBe(true);
      expect(result.daysUntilExpiry).toBe(0);
    });

    it('should handle exact warning boundary', () => {
      // Password changed exactly (maxAgeDays - warningDays) days ago
      const daysAgo = maxAgeDays - warningDays;
      const passwordChangedAt = new Date(Date.now() - daysAgo * msPerDay);

      const result = checkPasswordAge(passwordChangedAt);

      expect(result.isExpired).toBe(false);
      // At exactly warningDays, isWarning should be false (requires > 0 and <= warningDays)
      expect(result.daysUntilExpiry).toBe(warningDays);
    });
  });
});
