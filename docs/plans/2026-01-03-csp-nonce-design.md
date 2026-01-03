# CSP Nonce Implementation Design

**Issue:** #14 - Remove unsafe-eval and unsafe-inline from CSP
**Status:** Approved
**Date:** 2026-01-03

## Overview

The current Content Security Policy includes `unsafe-eval` and `unsafe-inline` directives which defeat XSS protection. This design implements per-request nonces to allow legitimate inline scripts while blocking injected ones.

## Architecture

### Request Flow

```
Request → Middleware → Generate Nonce → Set Header
                              ↓
         Root Layout ← Read Header ← Build CSP with Nonce
                              ↓
                    Response with CSP Header + Nonced Scripts
```

### Key Components

1. **`src/middleware.ts`** - Generates unique nonce per request, stores in `x-nonce` header
2. **`src/lib/security-headers.ts`** - Exports `buildCSP(nonce, isDev)` function
3. **`src/lib/security.ts`** - Remove duplicate CSP definitions (consolidation)

### Environment Handling

| Environment | script-src |
|-------------|------------|
| Development | `'self' 'nonce-xxx' 'unsafe-eval'` |
| Production  | `'self' 'nonce-xxx'` |

Development keeps `unsafe-eval` for HMR/hot reload. Production is strict.

## Implementation Details

### Middleware Changes

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  // Generate unique nonce for this request
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const response = NextResponse.next();

  // Pass nonce to downstream via header
  response.headers.set('x-nonce', nonce);

  // Build CSP with nonce
  const isDev = process.env.NODE_ENV === 'development';
  response.headers.set('Content-Security-Policy', buildCSP(nonce, isDev));

  // ... rest unchanged
}
```

### Security Headers Module

```typescript
// src/lib/security-headers.ts
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
} as const;

export function buildCSP(nonce: string, isDev: boolean = false): string {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",  // Keep for now
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}
```

### Cleanup

Remove duplicate CSP from `src/lib/security.ts` (lines 197-218) to consolidate into `security-headers.ts`.

## Files Changed

| File | Action |
|------|--------|
| `src/middleware.ts` | Add nonce generation, use `buildCSP()` |
| `src/lib/security-headers.ts` | Add `buildCSP()` function |
| `src/lib/security.ts` | Remove duplicate CSP (lines 197-218) |

## Testing

### Manual Testing

1. **Development mode:**
   - Verify HMR works
   - Check browser console for CSP violations (should be none)
   - Inspect headers: `script-src 'self' 'nonce-xxx' 'unsafe-eval'`

2. **Production mode:**
   - Run `npm run build && npm start`
   - Verify app loads correctly
   - Check headers: `script-src 'self' 'nonce-xxx'` (no unsafe-eval)

3. **Security validation:**
   - Inject `<script>alert('xss')</script>` - should be blocked

### Automated Test

```typescript
it('should set CSP header with nonce in production', async () => {
  const response = await fetch('/');
  const csp = response.headers.get('Content-Security-Policy');
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
});
```

## Acceptance Criteria

- [ ] CSP header contains nonce, not `unsafe-inline` in script-src
- [ ] Production CSP does not contain `unsafe-eval`
- [ ] Development HMR still works
- [ ] No CSP violations in browser console during normal usage
- [ ] XSS injection attempts are blocked

## Notes

- `style-src 'unsafe-inline'` kept for now - can be addressed in follow-up
- This also fixes issue #25 (duplicate security headers) as a side effect
