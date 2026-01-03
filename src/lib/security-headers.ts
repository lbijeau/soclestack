/**
 * Security Headers Module
 *
 * This module provides security headers including Content Security Policy (CSP)
 * with per-request nonce support.
 *
 * ## CSP Nonce Usage
 *
 * The middleware generates a unique nonce for each request and passes it via
 * the `x-nonce` response header. To use inline scripts with CSP:
 *
 * 1. In Server Components, read the nonce from headers:
 *    ```tsx
 *    import { headers } from 'next/headers';
 *
 *    export default async function Layout({ children }) {
 *      const nonce = (await headers()).get('x-nonce') ?? undefined;
 *      return (
 *        <html>
 *          <head>
 *            <script nonce={nonce} dangerouslySetInnerHTML={{ __html: '...' }} />
 *          </head>
 *          <body>{children}</body>
 *        </html>
 *      );
 *    }
 *    ```
 *
 * 2. For Next.js Script components:
 *    ```tsx
 *    import Script from 'next/script';
 *    <Script nonce={nonce} strategy="beforeInteractive">...</Script>
 *    ```
 *
 * Note: External scripts loaded via `src` attribute don't need nonces if they
 * match the 'self' directive. Only inline scripts require the nonce attribute.
 */

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
