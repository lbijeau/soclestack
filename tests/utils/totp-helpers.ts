import * as OTPAuth from 'otpauth';

/**
 * TOTP Helper Utilities for E2E Tests
 *
 * Provides functions to generate valid TOTP codes for testing 2FA flows.
 */

export interface TOTPConfig {
  issuer?: string;
  algorithm?: string;
  digits?: number;
  period?: number;
}

const DEFAULT_CONFIG: TOTPConfig = {
  issuer: 'SocleStack',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
};

/**
 * Generate a valid TOTP code from a secret
 */
export function generateTOTPCode(secret: string, config: TOTPConfig = {}): string {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const totp = new OTPAuth.TOTP({
    issuer: mergedConfig.issuer,
    algorithm: mergedConfig.algorithm,
    digits: mergedConfig.digits,
    period: mergedConfig.period,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.generate();
}

/**
 * Generate a TOTP secret for testing
 */
export function generateTOTPSecret(): string {
  const totp = new OTPAuth.TOTP({
    issuer: DEFAULT_CONFIG.issuer,
    algorithm: DEFAULT_CONFIG.algorithm,
    digits: DEFAULT_CONFIG.digits,
    period: DEFAULT_CONFIG.period,
  });

  return totp.secret.base32;
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTPCode(
  secret: string,
  code: string,
  config: TOTPConfig = {}
): boolean {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const totp = new OTPAuth.TOTP({
    issuer: mergedConfig.issuer,
    algorithm: mergedConfig.algorithm,
    digits: mergedConfig.digits,
    period: mergedConfig.period,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

/**
 * Generate an invalid TOTP code (for negative testing)
 */
export function generateInvalidTOTPCode(): string {
  // Return a code that won't match any valid TOTP
  return '000000';
}

/**
 * Generate an expired TOTP code (from a different time window)
 */
export function generateExpiredTOTPCode(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: DEFAULT_CONFIG.issuer,
    algorithm: DEFAULT_CONFIG.algorithm,
    digits: DEFAULT_CONFIG.digits,
    period: DEFAULT_CONFIG.period,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Generate code from 5 periods ago (2.5 minutes in the past)
  const pastTime = Math.floor(Date.now() / 1000) - 150;
  return totp.generate({ timestamp: pastTime * 1000 });
}

/**
 * Extract manual entry key from QR code data URL or setup response
 */
export function extractManualKey(setupResponse: {
  manualEntryKey?: string;
  secret?: string;
}): string {
  return setupResponse.manualEntryKey || setupResponse.secret || '';
}

/**
 * Wait for the next TOTP window to avoid timing issues
 * This ensures a fresh code that won't expire during the test
 */
export async function waitForFreshTOTPWindow(): Promise<void> {
  const now = Date.now();
  const currentPeriod = Math.floor(now / 30000);
  const nextPeriodStart = (currentPeriod + 1) * 30000;
  const waitTime = nextPeriodStart - now + 1000; // Add 1 second buffer

  if (waitTime < 5000) {
    // If we're close to the next period, wait for it
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}
