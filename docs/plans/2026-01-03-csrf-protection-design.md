# CSRF Protection Design

**Date:** 2026-01-03
**Issue:** #15
**Status:** Approved

## Overview

Implement CSRF (Cross-Site Request Forgery) protection using the Double-Submit Cookie pattern for all state-changing API requests.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      LOGIN / SESSION START                  │
│  1. Generate CSRF token                                     │
│  2. Set cookie: csrf_token=<token> (HttpOnly=false)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT REQUEST                         │
│  1. Read csrf_token from cookie (JS accessible)            │
│  2. Add header: X-CSRF-Token: <token>                      │
│  3. Send POST/PUT/DELETE/PATCH request                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      MIDDLEWARE                             │
│  1. Check if method is POST/PUT/DELETE/PATCH               │
│  2. Read csrf_token from cookie                            │
│  3. Read X-CSRF-Token from header                          │
│  4. Compare using timing-safe comparison                   │
│  5. Reject with 403 if mismatch                            │
└─────────────────────────────────────────────────────────────┘
```

## Why Double-Submit Cookie?

- **Stateless**: No database or session storage needed
- **Simple**: Easy to implement in middleware
- **Compatible**: Works with existing iron-session setup
- **Secure**: Combined with SameSite=Strict provides strong protection

## Implementation Components

### Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/lib/csrf.ts` | CSRF token generation, validation, cookie helpers |
| `src/middleware.ts` | Add CSRF validation for state-changing requests |
| `src/lib/auth.ts` | Set CSRF cookie on login/session creation |
| `src/lib/api-client.ts` | Client helper to auto-attach CSRF header |

### Token Specification

- **Length**: 32 bytes random, hex-encoded (64 chars)
- **Cookie name**: `csrf_token`
- **Header name**: `X-CSRF-Token`
- **Cookie options**:
  - `SameSite=Strict`
  - `Secure=true` (production only)
  - `HttpOnly=false` (must be readable by JS)
  - `Path=/`

### Excluded Routes

These routes are excluded from CSRF validation:

- `GET`, `HEAD`, `OPTIONS` requests (safe methods)
- `/api/auth/login` - Pre-session, no cookie yet
- `/api/auth/register` - Pre-session, no cookie yet
- `/api/auth/forgot-password` - Pre-session
- `/api/auth/reset-password` - Token-based auth
- `/api/auth/verify-email` - Token-based auth
- `/api/auth/oauth/*` - OAuth flow uses state tokens
- `/api/invites/*` - Token-based auth
- Requests with valid API keys (machine-to-machine)

### Error Responses

```json
{
  "error": "CSRF_ERROR",
  "message": "Invalid or missing CSRF token"
}
```

Status code: 403 Forbidden

## Client Integration

### API Client Helper

```typescript
// src/lib/api-client.ts
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function apiRequest(url: string, options: RequestInit = {}) {
  const csrfToken = getCsrfToken();
  const headers = new Headers(options.headers);

  const method = options.method?.toUpperCase() || 'GET';
  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  return fetch(url, { ...options, headers });
}
```

### Migration Strategy

1. Create `apiClient` with CSRF header injection
2. Update components to use `apiRequest()` instead of `fetch()`
3. Existing `fetch()` calls will fail with 403 until updated (fail-safe)

## Testing Strategy

### Unit Tests

- Token generation produces valid 64-char hex string
- Validation passes with matching tokens
- Validation fails with mismatched tokens
- Timing-safe comparison prevents timing attacks
- Cookie parsing handles edge cases

### E2E Tests

- Request without CSRF token → 403
- Request with mismatched token → 403
- Request with valid token → succeeds
- GET requests work without token
- API key requests bypass CSRF
- Login sets CSRF cookie

## Security Considerations

- **Timing-safe comparison**: Use constant-time comparison to prevent timing attacks
- **Token regeneration**: Generate new token on login (prevents session fixation)
- **Logging**: Log CSRF failures with IP + user agent for monitoring
- **No token logging**: Never log actual token values

## Acceptance Criteria

- [ ] All POST/PUT/DELETE/PATCH requests validate CSRF tokens
- [ ] CSRF cookie set on successful login
- [ ] Client components use apiRequest() helper
- [ ] Unit tests cover token generation and validation
- [ ] E2E tests verify protection works
- [ ] API key requests bypass CSRF (machine-to-machine)
