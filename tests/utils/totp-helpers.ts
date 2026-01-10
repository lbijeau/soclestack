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
 * Wait for a fresh TOTP window to avoid timing issues
 * This ensures the generated code has enough time before it expires
 *
 * If less than 10 seconds remain in the current 30-second window,
 * wait for the next window to start (plus a 1-second buffer).
 */
export async function waitForFreshTOTPWindow(): Promise<void> {
  const now = Date.now();
  const currentPeriod = Math.floor(now / 30000);
  const nextPeriodStart = (currentPeriod + 1) * 30000;
  const timeRemainingInWindow = nextPeriodStart - now;

  // If less than 10 seconds remain in current window, wait for next window
  if (timeRemainingInWindow < 10000) {
    await new Promise((resolve) => setTimeout(resolve, timeRemainingInWindow + 1000));
  }
}

/**
 * Result of a TOTP submission attempt
 */
export interface TOTPSubmitResult {
  success: boolean;
  error?: string;
}

/**
 * Options for TOTP submission with retry
 */
export interface TOTPRetryOptions {
  /** Maximum number of retry attempts (default: 2) */
  maxRetries?: number;
  /** Function to generate the code from secret */
  generateCode?: (secret: string) => string;
}

/**
 * Submit TOTP code with automatic retry on timing-related failures.
 *
 * This handles the edge case where a code could expire between generation
 * and submission due to network latency or slow test execution.
 *
 * @param page - Playwright Page object
 * @param secret - TOTP secret to generate codes from
 * @param submitFn - Function that fills and submits the code, returns success/error
 * @param options - Retry options
 * @returns Promise that resolves when submission succeeds
 * @throws Error if all retry attempts fail
 *
 * @example
 * ```typescript
 * await submitTOTPWithRetry(page, secret, async (code) => {
 *   await challengePage.verify(code);
 *   // Check if we're redirected (success) or see an error
 *   const error = await page.locator('[data-testid="error-message"]').textContent();
 *   return { success: !error, error: error || undefined };
 * });
 * ```
 */
export async function submitTOTPWithRetry(
  secret: string,
  submitFn: (code: string) => Promise<TOTPSubmitResult>,
  options: TOTPRetryOptions = {}
): Promise<void> {
  const { maxRetries = 2, generateCode = generateTOTPCode } = options;
  const timingErrorPatterns = ['expired', 'invalid', 'incorrect'];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await waitForFreshTOTPWindow();
    const code = generateCode(secret);

    const result = await submitFn(code);

    if (result.success) {
      return;
    }

    // Check if error is timing-related (might succeed with fresh code)
    const isTimingError =
      result.error &&
      timingErrorPatterns.some((pattern) =>
        result.error!.toLowerCase().includes(pattern)
      );

    // If not a timing error, don't retry
    if (!isTimingError) {
      throw new Error(`TOTP submission failed: ${result.error}`);
    }

    // If this was the last attempt, throw
    if (attempt === maxRetries) {
      throw new Error(
        `TOTP submission failed after ${maxRetries + 1} attempts: ${result.error}`
      );
    }

    // Wait before retry to ensure we're in a new TOTP window
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
