# Security & UX Hardening Design

**Date:** 2025-11-30
**Status:** Approved
**Scope:** Audit Logging, Account Lockout, Remember Me

## Overview

This phase adds three Enterprise-grade-style security features to SocleStack:

| Feature | Purpose | Dependencies |
|---------|---------|--------------|
| Audit Logging | Track security events for compliance & debugging | None (foundation) |
| Account Lockout | Prevent brute-force attacks | Audit Logging |
| Remember Me | Persistent login sessions | Audit Logging |

## 1. Audit Logging

### Purpose

Foundation layer that records security-relevant events. Required by Account Lockout and Remember Me for traceability.

### Database Schema

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  action      String
  category    String
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

### Event Types

```typescript
type AuditAction =
  // Authentication
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_REMEMBER_ME_CREATED'
  | 'AUTH_REMEMBER_ME_USED'
  | 'AUTH_REMEMBER_ME_REVOKED'
  | 'AUTH_REMEMBER_ME_THEFT_DETECTED'
  // Security
  | 'SECURITY_ACCOUNT_LOCKED'
  | 'SECURITY_ACCOUNT_UNLOCKED'
  | 'SECURITY_PASSWORD_CHANGED'
  | 'SECURITY_ALL_SESSIONS_REVOKED';

type AuditCategory = 'authentication' | 'security' | 'admin';
```

### Service Interface

```typescript
// src/lib/audit.ts

interface AuditEvent {
  action: AuditAction;
  category: AuditCategory;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

async function logAuditEvent(event: AuditEvent): Promise<void>;

async function getAuditLogs(filters: {
  userId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}): Promise<AuditLog[]>;
```

## 2. Account Lockout

### Purpose

Prevent brute-force password attacks by temporarily locking accounts after repeated failed login attempts.

### Configuration

```typescript
const LOCKOUT_CONFIG = {
  maxFailedAttempts: 5,
  durationMinutes: 15,
};
```

### Database Changes

Add to existing User model:

```prisma
model User {
  // ... existing fields ...
  failedLoginAttempts  Int       @default(0)
  lockedUntil          DateTime?
}
```

### Service Interface

```typescript
// src/lib/auth/lockout.ts

async function recordFailedAttempt(
  email: string,
  ipAddress: string
): Promise<{
  isLocked: boolean;
  remainingAttempts: number;
}>;

async function checkAccountLocked(userId: string): Promise<{
  isLocked: boolean;
  lockedUntil: Date | null;
}>;

async function resetFailedAttempts(userId: string): Promise<void>;

async function unlockAccount(
  userId: string,
  adminId: string
): Promise<void>;
```

### Login Flow

```
1. User submits credentials
2. Find user by email
3. If user exists, check if account is locked
   - If locked and lockout not expired: reject with ACCOUNT_LOCKED
   - If locked but expired: clear lockout, continue
4. Validate password
5. If invalid:
   - Increment failedLoginAttempts
   - If attempts >= 5: set lockedUntil = now + 15 minutes
   - Log AUTH_LOGIN_FAILURE
   - If just locked: log SECURITY_ACCOUNT_LOCKED
6. If valid:
   - Reset failedLoginAttempts to 0
   - Clear lockedUntil
   - Log AUTH_LOGIN_SUCCESS
   - Continue with session creation
```

### API Response (Locked)

```json
{
  "error": "ACCOUNT_LOCKED",
  "message": "Account temporarily locked due to too many failed attempts",
  "lockedUntil": "2025-11-30T10:15:00Z",
  "retryAfterSeconds": 900
}
```

## 3. Remember Me

### Purpose

Allow users to stay logged in across browser sessions with a secure persistent token.

### Configuration

```typescript
const REMEMBER_ME_CONFIG = {
  tokenLifetimeDays: 30,
  cookieName: 'remember_me',
};
```

### Database Schema

```prisma
model RememberMeToken {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String   @unique
  series      String   @unique
  expiresAt   DateTime
  ipAddress   String?
  userAgent   String?
  lastUsedAt  DateTime @default(now())
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

### Token Strategy

Token format: `{series}:{token}`

- **series**: Random ID that stays constant for the session series
- **token**: Random value that rotates on each use

This two-part approach detects token theft: if an attacker uses a stolen token, the legitimate user's next request will have a mismatched token for the same series, revealing the theft.

### Service Interface

```typescript
// src/lib/auth/remember-me.ts

async function createRememberMeToken(
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<{
  cookie: string;
  expiresAt: Date;
}>;

async function validateRememberMeToken(cookie: string): Promise<{
  valid: boolean;
  userId?: string;
  newCookie?: string;
  theftDetected?: boolean;
}>;

async function revokeRememberMeToken(series: string): Promise<void>;

async function revokeAllUserTokens(userId: string): Promise<void>;

async function getUserActiveSessions(userId: string): Promise<Array<{
  id: string;
  series: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: Date;
  createdAt: Date;
}>>;
```

### Cookie Configuration

```typescript
{
  name: 'remember_me',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  path: '/'
}
```

### Authentication Flow

**Login with Remember Me:**
1. User logs in with "Remember me" checked
2. After successful authentication:
   - Create session (existing flow)
   - Create RememberMeToken with series + hashed token
   - Set httpOnly cookie with `{series}:{token}`
   - Log AUTH_REMEMBER_ME_CREATED

**Auto-login via Remember Me:**
1. Request arrives without valid session
2. Check for remember_me cookie
3. Parse `{series}:{token}` from cookie
4. Look up token by series
5. If not found: cookie invalid, clear it
6. If found but token hash doesn't match: THEFT DETECTED
   - Revoke ALL user's tokens
   - Log AUTH_REMEMBER_ME_THEFT_DETECTED
   - Clear cookie, require full login
7. If found and token matches:
   - Check expiration
   - If valid: create session, rotate token, log AUTH_REMEMBER_ME_USED
   - Set new cookie with same series, new token

**Logout:**
1. Clear session (existing flow)
2. If remember_me cookie exists:
   - Revoke the token by series
   - Clear cookie
   - Log AUTH_REMEMBER_ME_REVOKED

## File Structure

### New Files

```
src/lib/
├── audit.ts                    # Audit logging service
├── config/
│   └── security.ts             # Security constants
└── auth/
    ├── lockout.ts              # Account lockout logic
    └── remember-me.ts          # Remember me token management

src/app/api/
└── users/
    └── [id]/
        ├── unlock/route.ts     # POST: Admin unlock account
        └── sessions/route.ts   # GET/DELETE: Manage sessions

src/app/(dashboard)/
└── profile/
    └── sessions/
        └── page.tsx            # View/revoke active sessions UI
```

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add AuditLog, RememberMeToken; extend User |
| `src/app/api/auth/login/route.ts` | Integrate lockout + remember-me |
| `src/app/api/auth/logout/route.ts` | Revoke remember-me token |
| `src/app/(auth)/login/page.tsx` | Add "Remember me" checkbox |
| `src/middleware.ts` | Check remember-me cookie for auto-login |

## Implementation Order

1. **Audit Logging** - Foundation with no dependencies
2. **Account Lockout** - Uses audit logging for events
3. **Remember Me** - Uses audit logging, most complex

## Security Considerations

- All tokens are hashed before storage (never store plaintext)
- Remember Me cookies are httpOnly and secure in production
- Token rotation prevents replay attacks
- Series-based tokens detect theft
- Account lockout prevents brute-force attacks
- All security events are audit logged for forensics

## Testing Strategy

- Unit tests for each service (audit, lockout, remember-me)
- Integration tests for login flow with lockout
- Integration tests for remember-me auto-login and rotation
- E2E tests for the full authentication flows
- Security tests for token theft detection
