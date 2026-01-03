# Auth Service Layer Design

## Overview

Extract business logic from auth route handlers into a service layer for testability, reusability, and maintainability.

## Scope

Auth routes only (~8 routes). User/org services will follow in separate PRs.

## Design Decisions

1. **Functional modules** - No classes, export functions from `auth.service.ts`
2. **Typed errors** - Services throw typed errors, routes catch and map to HTTP responses
3. **RequestContext** - Routes pass `{ clientIP, userAgent }` to services

## File Structure

```
src/services/
  auth.service.ts      # Core auth logic
  auth.errors.ts       # Typed error classes
```

## Error Classes

```typescript
// Base error
export class ServiceError extends Error {
  constructor(
    public readonly type: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

// Specific errors
export class ValidationError extends ServiceError { /* 400 */ }
export class AuthenticationError extends ServiceError { /* 401 */ }
export class AccountLockedError extends ServiceError { /* 423 */ }
export class EmailNotVerifiedError extends ServiceError { /* 403 */ }
export class RateLimitError extends ServiceError { /* 429 */ }
```

## Service Functions

### Core Types

```typescript
interface RequestContext {
  clientIP: string;
  userAgent?: string;
}

interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginResult {
  user: UserDTO;
  tokens: { accessToken: string; refreshToken: string };
  rememberMeCookie?: { value: string; expiresAt: Date };
  csrfToken: string;
}

interface TwoFactorRequired {
  requiresTwoFactor: true;
  pendingToken: string;
}
```

### Functions

```typescript
// Login/Logout
export async function login(input: LoginInput, context: RequestContext): Promise<LoginResult | TwoFactorRequired>
export async function logout(userId: string, sessionToken?: string): Promise<void>
export async function refreshTokens(refreshToken: string): Promise<TokenPair>

// Registration
export async function register(input: RegisterInput, context: RequestContext): Promise<RegisterResult>

// 2FA
export async function validate2FA(pendingToken: string, code: string, context: RequestContext): Promise<LoginResult>
export async function setup2FA(userId: string): Promise<{ secret: string; qrCodeUrl: string }>
export async function verify2FASetup(userId: string, code: string): Promise<{ backupCodes: string[] }>
export async function disable2FA(userId: string, code: string): Promise<void>

// Password reset
export async function requestPasswordReset(email: string, context: RequestContext): Promise<void>
export async function resetPassword(token: string, newPassword: string): Promise<void>

// Email verification
export async function verifyEmail(token: string): Promise<void>
export async function resendVerification(email: string): Promise<void>
```

## Route Handler Pattern

Routes become thin controllers (~20 lines):

```typescript
export async function POST(req: NextRequest) {
  const context = {
    clientIP: getClientIP(req),
    userAgent: req.headers.get('user-agent') || undefined
  };

  try {
    const body = await req.json();
    const result = await login(body, context);

    // Set cookies if needed
    if (result.rememberMeCookie) {
      // Set remember-me cookie
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleServiceError(error);
  }
}
```

## Shared Error Handler

```typescript
// src/lib/api-utils.ts
export function handleServiceError(error: unknown): NextResponse {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { error: { type: error.type, message: error.message, ...error.details } },
      { status: error.statusCode }
    );
  }
  console.error('Unexpected error:', error);
  return NextResponse.json(
    { error: { type: 'SERVER_ERROR', message: 'An internal server error occurred' } },
    { status: 500 }
  );
}
```

## Testing Strategy

- Unit tests in `tests/unit/services/auth.service.spec.ts`
- Mock `prisma`, `logAuditEvent`, email functions
- Test each error path and success path
- No HTTP mocking needed - pure function tests

## Implementation Order

1. Create error classes (`auth.errors.ts`)
2. Create service with `login()` function
3. Refactor login route to use service
4. Add remaining functions one by one
5. Add unit tests for each function

## Parent Issue

#26 (Create service layer for business logic)
