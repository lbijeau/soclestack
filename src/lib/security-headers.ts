// Security headers configuration - Edge Runtime compatible
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
} as const;

/**
 * Build Content Security Policy with per-request nonce
 *
 * @param nonce - Unique nonce for this request (base64 encoded)
 * @param isDev - Whether running in development mode (allows unsafe-eval for HMR)
 * @returns CSP header string
 */
export function buildCSP(nonce: string, isDev: boolean = false): string {
  // Development needs unsafe-eval for hot module replacement
  // Production is strict - only nonced scripts allowed
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Keep for now - can be nonced in follow-up
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

// Legacy static export for backward compatibility during migration
// TODO: Remove once all consumers use buildCSP()
export const contentSecurityPolicy = buildCSP('', false);
