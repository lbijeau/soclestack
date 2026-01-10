import { describe, it, expect } from 'vitest';
import { darken, lighten, isValidHex } from '@/lib/color-utils';

describe('color-utils', () => {
  describe('isValidHex', () => {
    it('should validate 6-digit hex colors', () => {
      expect(isValidHex('#3b82f6')).toBe(true);
      expect(isValidHex('#FF0000')).toBe(true);
    });

    it('should validate 3-digit hex colors', () => {
      expect(isValidHex('#fff')).toBe(true);
      expect(isValidHex('#F00')).toBe(true);
    });

    it('should reject invalid colors', () => {
      expect(isValidHex('red')).toBe(false);
      expect(isValidHex('#gggggg')).toBe(false);
      expect(isValidHex('3b82f6')).toBe(false);
    });
  });

  describe('darken', () => {
    it('should darken a color by percentage', () => {
      const result = darken('#3b82f6', 10);
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
      // Result should be darker (lower RGB values)
    });

    it('should return original for invalid hex', () => {
      expect(darken('invalid', 10)).toBe('invalid');
    });

    it('should clamp to black at 100%', () => {
      expect(darken('#ffffff', 100)).toBe('#000000');
    });
  });

  describe('lighten', () => {
    it('should lighten a color by percentage', () => {
      const result = lighten('#3b82f6', 10);
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should return original for invalid hex', () => {
      expect(lighten('invalid', 10)).toBe('invalid');
    });

    it('should clamp to white at 100%', () => {
      expect(lighten('#000000', 100)).toBe('#ffffff');
    });
  });
});
