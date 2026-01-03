import { describe, it, expect } from 'vitest';
import { calculatePasswordStrength } from '@/lib/utils/password-strength';

/**
 * Password Strength tests.
 *
 * These tests verify the password strength calculation logic that
 * evaluates passwords based on length, complexity, and patterns.
 */

describe('Password Strength Calculation', () => {
  describe('Empty and Basic Passwords', () => {
    it('should return very weak for empty password', () => {
      const result = calculatePasswordStrength('');

      expect(result.score).toBe(0);
      expect(result.label).toBe('Very Weak');
      expect(result.suggestions).toContain('Enter a password');
    });

    it('should return very weak for common passwords', () => {
      const commonPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'letmein',
        'admin',
        'password123',
      ];

      for (const password of commonPasswords) {
        const result = calculatePasswordStrength(password);
        expect(result.score).toBe(0);
        expect(result.label).toBe('Very Weak');
        expect(
          result.suggestions.some((s) => s.toLowerCase().includes('common'))
        ).toBe(true);
      }
    });

    it('should be case-insensitive for common password check', () => {
      const result = calculatePasswordStrength('PASSWORD');

      expect(result.score).toBe(0);
      expect(result.label).toBe('Very Weak');
    });
  });

  describe('Password Requirements', () => {
    it('should track length requirement', () => {
      const shortPassword = calculatePasswordStrength('Ab1!');
      const longPassword = calculatePasswordStrength('Abcd1234!');

      expect(shortPassword.requirements[0].met).toBe(false);
      expect(longPassword.requirements[0].met).toBe(true);
    });

    it('should track uppercase requirement', () => {
      const noUpper = calculatePasswordStrength('abcdefgh1!');
      const withUpper = calculatePasswordStrength('Abcdefgh1!');

      expect(noUpper.requirements[1].met).toBe(false);
      expect(withUpper.requirements[1].met).toBe(true);
    });

    it('should track lowercase requirement', () => {
      const noLower = calculatePasswordStrength('ABCDEFGH1!');
      const withLower = calculatePasswordStrength('ABCDEFGh1!');

      expect(noLower.requirements[2].met).toBe(false);
      expect(withLower.requirements[2].met).toBe(true);
    });

    it('should track number requirement', () => {
      const noNumber = calculatePasswordStrength('Abcdefgh!');
      const withNumber = calculatePasswordStrength('Abcdefg1!');

      expect(noNumber.requirements[3].met).toBe(false);
      expect(withNumber.requirements[3].met).toBe(true);
    });

    it('should track special character requirement', () => {
      const noSpecial = calculatePasswordStrength('Abcdefgh1');
      const withSpecial = calculatePasswordStrength('Abcdefg1!');

      expect(noSpecial.requirements[4].met).toBe(false);
      expect(withSpecial.requirements[4].met).toBe(true);
    });
  });

  describe('Score Calculation', () => {
    it('should give higher score for more requirements met', () => {
      const lowScore = calculatePasswordStrength('zxcvbnmq'); // only lowercase + length, no patterns
      const midScore = calculatePasswordStrength('Zxcvbnm1'); // + uppercase + number
      const highScore = calculatePasswordStrength('Zxcvbnm1!'); // + special

      expect(lowScore.score).toBeLessThanOrEqual(midScore.score);
      expect(midScore.score).toBeLessThanOrEqual(highScore.score);
    });

    it('should give bonus for passwords 12+ characters', () => {
      const short = calculatePasswordStrength('Zxcvbnm1!'); // 9 chars
      const long = calculatePasswordStrength('Zxcvbnmqwer1!'); // 13 chars

      expect(long.score).toBeGreaterThanOrEqual(short.score);
    });

    it('should give bonus for passwords 16+ characters', () => {
      const result = calculatePasswordStrength('Zxcvbnmqwertyu1!'); // 16 chars, no sequential

      // Score should be high (3 or 4) for a strong long password
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(['Strong', 'Very Strong']).toContain(result.label);
    });
  });

  describe('Pattern Penalties', () => {
    it('should penalize repeating characters', () => {
      const withRepeats = calculatePasswordStrength('Aaaa1234!');
      const noRepeats = calculatePasswordStrength('Abcd1234!');

      expect(withRepeats.score).toBeLessThanOrEqual(noRepeats.score);
      expect(
        withRepeats.suggestions.some((s) =>
          s.toLowerCase().includes('repeating')
        )
      ).toBe(true);
    });

    it('should penalize sequential characters', () => {
      const withSequence = calculatePasswordStrength('Abc12345!');
      const noSequence = calculatePasswordStrength('Axz97531!');

      expect(withSequence.score).toBeLessThanOrEqual(noSequence.score);
    });

    it('should penalize only letters', () => {
      const onlyLetters = calculatePasswordStrength('Abcdefghij');
      const mixed = calculatePasswordStrength('Abcdefgh1!');

      expect(onlyLetters.score).toBeLessThan(mixed.score);
    });

    it('should penalize only numbers', () => {
      const onlyNumbers = calculatePasswordStrength('1234567890');
      const mixed = calculatePasswordStrength('Abcdefgh1!');

      expect(onlyNumbers.score).toBeLessThan(mixed.score);
    });
  });

  describe('Score Labels', () => {
    it('should label score 0 as Very Weak', () => {
      const result = calculatePasswordStrength('password');
      expect(result.label).toBe('Very Weak');
    });

    it('should have corresponding colors for each score', () => {
      const veryWeak = calculatePasswordStrength('password');
      const strong = calculatePasswordStrength('StrongP@ssw0rd!');

      expect(veryWeak.color).toContain('red');
      expect(strong.color).toContain('green');
    });
  });

  describe('Suggestions', () => {
    it('should suggest length when password is short', () => {
      const result = calculatePasswordStrength('Ab1!');

      expect(
        result.suggestions.some((s) =>
          s.toLowerCase().includes('8 characters')
        )
      ).toBe(true);
    });

    it('should suggest uppercase when missing', () => {
      const result = calculatePasswordStrength('abcdefgh1!');

      expect(
        result.suggestions.some((s) =>
          s.toLowerCase().includes('uppercase')
        )
      ).toBe(true);
    });

    it('should suggest lowercase when missing', () => {
      const result = calculatePasswordStrength('ABCDEFGH1!');

      expect(
        result.suggestions.some((s) =>
          s.toLowerCase().includes('lowercase')
        )
      ).toBe(true);
    });

    it('should suggest number when missing', () => {
      const result = calculatePasswordStrength('Abcdefgh!');

      expect(
        result.suggestions.some((s) =>
          s.toLowerCase().includes('number')
        )
      ).toBe(true);
    });

    it('should suggest special character when missing', () => {
      const result = calculatePasswordStrength('Abcdefgh1');

      expect(
        result.suggestions.some((s) =>
          s.toLowerCase().includes('special')
        )
      ).toBe(true);
    });

    it('should suggest longer password when under 12 chars', () => {
      const result = calculatePasswordStrength('Abcdefg1!');

      expect(
        result.suggestions.some((s) =>
          s.toLowerCase().includes('longer') || s.includes('12+')
        )
      ).toBe(true);
    });

    it('should limit suggestions to 3', () => {
      const result = calculatePasswordStrength('a'); // Very weak, many suggestions possible

      expect(result.suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long passwords', () => {
      const longPassword = 'A'.repeat(100) + 'a1!';
      const result = calculatePasswordStrength(longPassword);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle unicode characters', () => {
      const result = calculatePasswordStrength('Pässwörd123!');

      expect(result).toBeDefined();
      expect(result.requirements[0].met).toBe(true); // Length >= 8
    });

    it('should handle special characters in password', () => {
      const result = calculatePasswordStrength('P@$$w0rd!#$%');

      expect(result.requirements[4].met).toBe(true); // Special chars
    });

    it('should return consistent results for same password', () => {
      const password = 'TestPassword123!';
      const result1 = calculatePasswordStrength(password);
      const result2 = calculatePasswordStrength(password);

      expect(result1.score).toBe(result2.score);
      expect(result1.label).toBe(result2.label);
    });
  });
});
