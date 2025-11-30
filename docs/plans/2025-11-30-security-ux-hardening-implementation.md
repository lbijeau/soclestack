# Security & UX Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Audit Logging, Account Lockout, and Remember Me features for Enterprise-grade-style security.

**Architecture:** Three-layer approach: (1) Audit logging as foundation service, (2) Account lockout integrated into login flow, (3) Remember Me with rotating tokens. All changes build on existing iron-session + JWT authentication.

**Tech Stack:** Prisma (SQLite), Next.js 14 App Router, TypeScript, iron-session, bcryptjs

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add new models and fields to schema**

Add these models and fields to `prisma/schema.prisma`:

```prisma
// Add to existing User model (after passwordHistory relation):
model User {
  // ... existing fields ...

  // Account lockout fields
  failedLoginAttempts  Int       @default(0) @map("failed_login_attempts")
  lockedUntil          DateTime? @map("locked_until")

  // ... existing relations ...
  auditLogs            AuditLog[]
  rememberMeTokens     RememberMeToken[]
}

// Add new AuditLog model
model AuditLog {
  id          String   @id @default(cuid())
  userId      String?  @map("user_id")
  user        User?    @relation(fields: [userId], references: [id])
  action      String
  category    String
  ipAddress   String?  @map("ip_address")
  userAgent   String?  @map("user_agent")
  metadata    String?  // JSON string for SQLite compatibility
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}

// Add new RememberMeToken model
model RememberMeToken {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String   @unique @map("token_hash")
  series      String   @unique
  expiresAt   DateTime @map("expires_at")
  ipAddress   String?  @map("ip_address")
  userAgent   String?  @map("user_agent")
  lastUsedAt  DateTime @default(now()) @map("last_used_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([expiresAt])
  @@map("remember_me_tokens")
}
```

**Step 2: Run Prisma migration**

Run: `npx prisma db push`
Expected: Database schema updated successfully

**Step 3: Verify schema changes**

Run: `npx prisma studio`
Expected: See new AuditLog, RememberMeToken tables and new User fields

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add AuditLog, RememberMeToken models and lockout fields"
```

---

## Task 2: Create Security Config

**Files:**
- Create: `src/lib/config/security.ts`

**Step 1: Create security configuration file**

Create `src/lib/config/security.ts`:

```typescript
export const SECURITY_CONFIG = {
  lockout: {
    maxFailedAttempts: 5,
    durationMinutes: 15,
  },
  rememberMe: {
    tokenLifetimeDays: 30,
    cookieName: 'remember_me',
  },
} as const;

export type SecurityConfig = typeof SECURITY_CONFIG;
```

**Step 2: Commit**

```bash
git add src/lib/config/security.ts
git commit -m "feat(config): add security configuration constants"
```

---

## Task 3: Implement Audit Logging Service

**Files:**
- Create: `src/lib/audit.ts`

**Step 1: Create audit logging service**

Create `src/lib/audit.ts`:

```typescript
import { prisma } from './db';

export type AuditAction =
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

export type AuditCategory = 'authentication' | 'security' | 'admin';

export interface AuditEvent {
  action: AuditAction;
  category: AuditCategory;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: event.userId,
        action: event.action,
        category: event.category,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    });
  } catch (error) {
    // Log to console but don't throw - audit logging should not break the app
    console.error('Failed to log audit event:', error);
  }
}

export async function getAuditLogs(filters: {
  userId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}): Promise<Array<{
  id: string;
  userId: string | null;
  action: string;
  category: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}>> {
  const logs = await prisma.auditLog.findMany({
    where: {
      userId: filters.userId,
      action: filters.action,
      category: filters.category,
      createdAt: {
        gte: filters.from,
        lte: filters.to,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 100,
    skip: filters.offset || 0,
  });

  return logs.map((log) => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
  }));
}
```

**Step 2: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat(audit): implement audit logging service"
```

---

## Task 4: Implement Account Lockout Service

**Files:**
- Create: `src/lib/auth/lockout.ts`

**Step 1: Create lockout service**

Create `src/lib/auth/lockout.ts`:

```typescript
import { prisma } from '../db';
import { logAuditEvent } from '../audit';
import { SECURITY_CONFIG } from '../config/security';

const { maxFailedAttempts, durationMinutes } = SECURITY_CONFIG.lockout;

export interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: Date | null;
  remainingAttempts: number;
}

export async function checkAccountLocked(userId: string): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true, failedLoginAttempts: true },
  });

  if (!user) {
    return { isLocked: false, lockedUntil: null, remainingAttempts: maxFailedAttempts };
  }

  const now = new Date();

  // Check if lockout has expired
  if (user.lockedUntil && user.lockedUntil > now) {
    return {
      isLocked: true,
      lockedUntil: user.lockedUntil,
      remainingAttempts: 0,
    };
  }

  // Lockout expired, clear it
  if (user.lockedUntil && user.lockedUntil <= now) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
    return { isLocked: false, lockedUntil: null, remainingAttempts: maxFailedAttempts };
  }

  return {
    isLocked: false,
    lockedUntil: null,
    remainingAttempts: maxFailedAttempts - user.failedLoginAttempts,
  };
}

export async function recordFailedAttempt(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, email: true },
  });

  if (!user) {
    return { isLocked: false, lockedUntil: null, remainingAttempts: maxFailedAttempts };
  }

  const newAttempts = user.failedLoginAttempts + 1;
  const shouldLock = newAttempts >= maxFailedAttempts;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + durationMinutes * 60 * 1000)
    : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newAttempts,
      lockedUntil,
    },
  });

  // Log the lockout event if account was just locked
  if (shouldLock) {
    await logAuditEvent({
      action: 'SECURITY_ACCOUNT_LOCKED',
      category: 'security',
      userId,
      ipAddress,
      userAgent,
      metadata: { reason: 'too_many_failed_attempts', attempts: newAttempts },
    });
  }

  return {
    isLocked: shouldLock,
    lockedUntil,
    remainingAttempts: shouldLock ? 0 : maxFailedAttempts - newAttempts,
  };
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

export async function unlockAccount(
  userId: string,
  adminId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await logAuditEvent({
    action: 'SECURITY_ACCOUNT_UNLOCKED',
    category: 'admin',
    userId,
    ipAddress,
    userAgent,
    metadata: { unlockedBy: adminId },
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/auth/lockout.ts
git commit -m "feat(auth): implement account lockout service"
```

---

## Task 5: Implement Remember Me Service

**Files:**
- Create: `src/lib/auth/remember-me.ts`

**Step 1: Create remember me service**

Create `src/lib/auth/remember-me.ts`:

```typescript
import { prisma } from '../db';
import { logAuditEvent } from '../audit';
import { SECURITY_CONFIG } from '../config/security';
import { generateSessionToken, hashSessionToken } from '../security';

const { tokenLifetimeDays, cookieName } = SECURITY_CONFIG.rememberMe;

export { cookieName as REMEMBER_ME_COOKIE_NAME };

export interface RememberMeValidationResult {
  valid: boolean;
  userId?: string;
  newCookie?: string;
  theftDetected?: boolean;
}

export async function createRememberMeToken(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ cookie: string; expiresAt: Date }> {
  const series = await generateSessionToken();
  const token = await generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + tokenLifetimeDays * 24 * 60 * 60 * 1000);

  await prisma.rememberMeToken.create({
    data: {
      userId,
      series,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  await logAuditEvent({
    action: 'AUTH_REMEMBER_ME_CREATED',
    category: 'authentication',
    userId,
    ipAddress,
    userAgent,
  });

  return {
    cookie: `${series}:${token}`,
    expiresAt,
  };
}

export async function validateRememberMeToken(
  cookie: string,
  ipAddress?: string,
  userAgent?: string
): Promise<RememberMeValidationResult> {
  const parts = cookie.split(':');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [series, token] = parts;
  const tokenHash = await hashSessionToken(token);

  const storedToken = await prisma.rememberMeToken.findUnique({
    where: { series },
    include: { user: true },
  });

  if (!storedToken) {
    return { valid: false };
  }

  // Check expiration
  if (storedToken.expiresAt < new Date()) {
    await prisma.rememberMeToken.delete({ where: { series } });
    return { valid: false };
  }

  // Check token hash - if mismatch, theft detected!
  if (storedToken.tokenHash !== tokenHash) {
    // Revoke ALL tokens for this user - security breach!
    await revokeAllUserTokens(storedToken.userId);

    await logAuditEvent({
      action: 'AUTH_REMEMBER_ME_THEFT_DETECTED',
      category: 'security',
      userId: storedToken.userId,
      ipAddress,
      userAgent,
      metadata: { series },
    });

    return { valid: false, theftDetected: true };
  }

  // Check user is still active
  if (!storedToken.user.isActive) {
    await prisma.rememberMeToken.delete({ where: { series } });
    return { valid: false };
  }

  // Rotate token - generate new token, keep same series
  const newToken = await generateSessionToken();
  const newTokenHash = await hashSessionToken(newToken);

  await prisma.rememberMeToken.update({
    where: { series },
    data: {
      tokenHash: newTokenHash,
      lastUsedAt: new Date(),
      ipAddress,
      userAgent,
    },
  });

  await logAuditEvent({
    action: 'AUTH_REMEMBER_ME_USED',
    category: 'authentication',
    userId: storedToken.userId,
    ipAddress,
    userAgent,
  });

  return {
    valid: true,
    userId: storedToken.userId,
    newCookie: `${series}:${newToken}`,
  };
}

export async function revokeRememberMeToken(
  series: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const token = await prisma.rememberMeToken.findUnique({
    where: { series },
  });

  if (token) {
    await prisma.rememberMeToken.delete({ where: { series } });

    await logAuditEvent({
      action: 'AUTH_REMEMBER_ME_REVOKED',
      category: 'authentication',
      userId: userId || token.userId,
      ipAddress,
      userAgent,
    });
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.rememberMeToken.deleteMany({
    where: { userId },
  });
}

export async function getUserActiveSessions(userId: string): Promise<Array<{
  id: string;
  series: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: Date;
  createdAt: Date;
}>> {
  return prisma.rememberMeToken.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      series: true,
      ipAddress: true,
      userAgent: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { lastUsedAt: 'desc' },
  });
}

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.rememberMeToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
```

**Step 2: Commit**

```bash
git add src/lib/auth/remember-me.ts
git commit -m "feat(auth): implement remember me token service"
```

---

## Task 6: Update Login API Route

**Files:**
- Modify: `src/app/api/auth/login/route.ts`

**Step 1: Update login route with lockout and remember-me**

Replace `src/app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginSchema } from '@/lib/validations';
import { authenticateUser, createUserSession, getClientIP, isRateLimited } from '@/lib/auth';
import { AuthError } from '@/types/auth';
import { checkAccountLocked, recordFailedAttempt, resetFailedAttempts } from '@/lib/auth/lockout';
import { createRememberMeToken, REMEMBER_ME_COOKIE_NAME } from '@/lib/auth/remember-me';
import { logAuditEvent } from '@/lib/audit';
import { SECURITY_CONFIG } from '@/lib/config/security';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    // Rate limiting
    const rateLimitKey = `login:${clientIP}`;

    if (isRateLimited(rateLimitKey, 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Too many login attempts. Please try again later.',
          } as AuthError,
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: validationResult.error.flatten().fieldErrors,
          } as AuthError,
        },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = validationResult.data;

    // Find user first to check lockout
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Check if account is locked
      const lockoutStatus = await checkAccountLocked(user.id);
      if (lockoutStatus.isLocked) {
        const retryAfterSeconds = lockoutStatus.lockedUntil
          ? Math.ceil((lockoutStatus.lockedUntil.getTime() - Date.now()) / 1000)
          : SECURITY_CONFIG.lockout.durationMinutes * 60;

        return NextResponse.json(
          {
            error: {
              type: 'ACCOUNT_LOCKED',
              message: 'Account temporarily locked due to too many failed attempts',
              lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
              retryAfterSeconds,
            },
          },
          { status: 423 }
        );
      }
    }

    // Authenticate user
    const authenticatedUser = await authenticateUser(email, password);
    if (!authenticatedUser) {
      // Record failed attempt if user exists
      if (user) {
        const lockoutStatus = await recordFailedAttempt(user.id, clientIP, userAgent);

        await logAuditEvent({
          action: 'AUTH_LOGIN_FAILURE',
          category: 'authentication',
          userId: user.id,
          ipAddress: clientIP,
          userAgent,
          metadata: { reason: 'invalid_password' },
        });

        if (lockoutStatus.isLocked) {
          const retryAfterSeconds = lockoutStatus.lockedUntil
            ? Math.ceil((lockoutStatus.lockedUntil.getTime() - Date.now()) / 1000)
            : SECURITY_CONFIG.lockout.durationMinutes * 60;

          return NextResponse.json(
            {
              error: {
                type: 'ACCOUNT_LOCKED',
                message: 'Account temporarily locked due to too many failed attempts',
                lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
                retryAfterSeconds,
              },
            },
            { status: 423 }
          );
        }
      } else {
        await logAuditEvent({
          action: 'AUTH_LOGIN_FAILURE',
          category: 'authentication',
          ipAddress: clientIP,
          userAgent,
          metadata: { reason: 'user_not_found', email },
        });
      }

      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Invalid email or password',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!authenticatedUser.emailVerified) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Please verify your email before logging in',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Reset failed attempts on successful login
    await resetFailedAttempts(authenticatedUser.id);

    // Create session
    const tokens = await createUserSession(authenticatedUser, clientIP, userAgent);

    // Log successful login
    await logAuditEvent({
      action: 'AUTH_LOGIN_SUCCESS',
      category: 'authentication',
      userId: authenticatedUser.id,
      ipAddress: clientIP,
      userAgent,
    });

    // Handle Remember Me
    const cookieStore = await cookies();
    if (rememberMe) {
      const rememberMeResult = await createRememberMeToken(
        authenticatedUser.id,
        clientIP,
        userAgent
      );

      cookieStore.set(REMEMBER_ME_COOKIE_NAME, rememberMeResult.cookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: rememberMeResult.expiresAt,
        path: '/',
      });
    }

    // Return success response
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        username: authenticatedUser.username,
        firstName: authenticatedUser.firstName,
        lastName: authenticatedUser.lastName,
        role: authenticatedUser.role,
        isActive: authenticatedUser.isActive,
        emailVerified: authenticatedUser.emailVerified,
        lastLoginAt: authenticatedUser.lastLoginAt,
        createdAt: authenticatedUser.createdAt,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Update login validation schema**

Modify `src/lib/validations.ts` to add `rememberMe` field:

Find the `loginSchema` and add the `rememberMe` field:

```typescript
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional().default(false),
});
```

**Step 3: Commit**

```bash
git add src/app/api/auth/login/route.ts src/lib/validations.ts
git commit -m "feat(auth): integrate lockout and remember-me into login flow"
```

---

## Task 7: Update Logout API Route

**Files:**
- Modify: `src/app/api/auth/logout/route.ts`

**Step 1: Read current logout route**

Read `src/app/api/auth/logout/route.ts` to understand current implementation.

**Step 2: Update logout to revoke remember-me token**

Update `src/app/api/auth/logout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logoutUser, getClientIP } from '@/lib/auth';
import { revokeRememberMeToken, REMEMBER_ME_COOKIE_NAME } from '@/lib/auth/remember-me';
import { logAuditEvent } from '@/lib/audit';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    // Get current session to log the event
    const session = await getSession();
    const userId = session.userId;

    // Revoke remember-me token if exists
    const cookieStore = await cookies();
    const rememberMeCookie = cookieStore.get(REMEMBER_ME_COOKIE_NAME);

    if (rememberMeCookie?.value) {
      const series = rememberMeCookie.value.split(':')[0];
      if (series) {
        await revokeRememberMeToken(series, userId, clientIP, userAgent);
      }

      // Clear the cookie
      cookieStore.delete(REMEMBER_ME_COOKIE_NAME);
    }

    // Log the logout event
    if (userId) {
      await logAuditEvent({
        action: 'AUTH_LOGOUT',
        category: 'authentication',
        userId,
        ipAddress: clientIP,
        userAgent,
      });
    }

    // Logout from session
    await logoutUser();

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to logout' } },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/auth/logout/route.ts
git commit -m "feat(auth): revoke remember-me token on logout"
```

---

## Task 8: Update Login Form Component

**Files:**
- Modify: `src/components/auth/login-form.tsx`

**Step 1: Add Remember Me checkbox to login form**

Update `src/components/auth/login-form.tsx` to add the Remember Me checkbox:

Add state for rememberMe:
```typescript
const [rememberMe, setRememberMe] = useState(false);
```

Add to the form data sent:
```typescript
body: JSON.stringify({ ...formData, rememberMe }),
```

Add the checkbox UI between password field and submit button:
```typescript
<div className="flex items-center justify-between">
  <div className="flex items-center">
    <input
      id="remember-me"
      name="remember-me"
      type="checkbox"
      data-testid="remember-me-checkbox"
      checked={rememberMe}
      onChange={(e) => setRememberMe(e.target.checked)}
      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
    />
    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
      Remember me
    </label>
  </div>
</div>
```

Also add data-testid attributes to existing elements for E2E tests:
- Add `data-testid="login-form"` to the form element
- Add `data-testid="email-input"` to email input
- Add `data-testid="password-input"` to password input
- Add `data-testid="login-submit"` to submit button
- Add `data-testid="forgot-password-link"` to forgot password link
- Add `data-testid="register-link"` to register link

**Step 2: Handle account locked error**

Add handling for ACCOUNT_LOCKED error type in the error handling:

```typescript
if (authError.type === 'ACCOUNT_LOCKED') {
  setError(authError.message);
  setIsLocked(true);
  setLockedUntil(authError.lockedUntil ? new Date(authError.lockedUntil) : null);
}
```

**Step 3: Commit**

```bash
git add src/components/auth/login-form.tsx
git commit -m "feat(ui): add remember-me checkbox and lockout handling to login form"
```

---

## Task 9: Update Middleware for Remember Me Auto-Login

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Add remember-me cookie check to middleware**

The middleware needs to check for remember_me cookie when there's no active session and auto-login. However, middleware runs in Edge Runtime and can't use Prisma directly.

Create a new API route for remember-me validation that middleware can call, or handle it client-side. For simplicity, we'll handle it in the auth context/client-side on initial load.

**Alternative approach:** Create an API endpoint that validates remember-me and returns session.

Create `src/app/api/auth/session/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, createUserSession, getClientIP } from '@/lib/auth';
import { validateRememberMeToken, REMEMBER_ME_COOKIE_NAME } from '@/lib/auth/remember-me';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    // Check existing session first
    const session = await getSession();
    if (session.isLoggedIn && session.userId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId, isActive: true },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
        },
      });

      if (user) {
        return NextResponse.json({ user, authenticated: true });
      }
    }

    // No active session, check remember-me cookie
    const cookieStore = await cookies();
    const rememberMeCookie = cookieStore.get(REMEMBER_ME_COOKIE_NAME);

    if (rememberMeCookie?.value) {
      const result = await validateRememberMeToken(
        rememberMeCookie.value,
        clientIP,
        userAgent
      );

      if (result.theftDetected) {
        // Clear the cookie and force re-login
        cookieStore.delete(REMEMBER_ME_COOKIE_NAME);
        return NextResponse.json(
          { error: 'Session compromised. Please login again.', authenticated: false },
          { status: 401 }
        );
      }

      if (result.valid && result.userId) {
        const user = await prisma.user.findUnique({
          where: { id: result.userId, isActive: true },
        });

        if (user && user.emailVerified) {
          // Create new session
          await createUserSession(user, clientIP, userAgent);

          // Update cookie with rotated token
          if (result.newCookie) {
            cookieStore.set(REMEMBER_ME_COOKIE_NAME, result.newCookie, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 30 * 24 * 60 * 60, // 30 days
              path: '/',
            });
          }

          return NextResponse.json({
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              isActive: user.isActive,
              emailVerified: user.emailVerified,
            },
            authenticated: true,
            rememberMeUsed: true,
          });
        }
      }

      // Invalid remember-me token, clear it
      cookieStore.delete(REMEMBER_ME_COOKIE_NAME);
    }

    return NextResponse.json({ authenticated: false });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/session/route.ts
git commit -m "feat(auth): add session endpoint with remember-me auto-login"
```

---

## Task 10: Add Admin Unlock Account Endpoint

**Files:**
- Create: `src/app/api/users/[id]/unlock/route.ts`

**Step 1: Create unlock endpoint**

Create `src/app/api/users/[id]/unlock/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { unlockAccount } from '@/lib/auth/lockout';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const session = await getSession();

    // Check authentication
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check admin role
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    await unlockAccount(userId, session.userId, clientIP, userAgent);

    return NextResponse.json({ message: 'Account unlocked successfully' });
  } catch (error) {
    console.error('Unlock account error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to unlock account' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/users/[id]/unlock/route.ts
git commit -m "feat(admin): add endpoint to unlock user accounts"
```

---

## Task 11: Add Sessions Management Endpoint

**Files:**
- Create: `src/app/api/users/[id]/sessions/route.ts`

**Step 1: Create sessions endpoint**

Create `src/app/api/users/[id]/sessions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { getUserActiveSessions, revokeRememberMeToken, revokeAllUserTokens } from '@/lib/auth/remember-me';
import { logAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

// GET - List active sessions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Users can only view their own sessions, admins can view any
    if (session.userId !== userId && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Not authorized' } },
        { status: 403 }
      );
    }

    const sessions = await getUserActiveSessions(userId);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to get sessions' } },
      { status: 500 }
    );
  }
}

// DELETE - Revoke session(s)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Users can only revoke their own sessions, admins can revoke any
    if (session.userId !== userId && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Not authorized' } },
        { status: 403 }
      );
    }

    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    const { searchParams } = new URL(req.url);
    const series = searchParams.get('series');
    const all = searchParams.get('all') === 'true';

    if (all) {
      await revokeAllUserTokens(userId);
      await logAuditEvent({
        action: 'SECURITY_ALL_SESSIONS_REVOKED',
        category: 'security',
        userId,
        ipAddress: clientIP,
        userAgent,
        metadata: { revokedBy: session.userId },
      });
      return NextResponse.json({ message: 'All sessions revoked' });
    }

    if (series) {
      await revokeRememberMeToken(series, userId, clientIP, userAgent);
      return NextResponse.json({ message: 'Session revoked' });
    }

    return NextResponse.json(
      { error: { type: 'VALIDATION_ERROR', message: 'Specify series or all=true' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Revoke session error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to revoke session' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/users/[id]/sessions/route.ts
git commit -m "feat(api): add sessions management endpoints"
```

---

## Task 12: Verify Build and Types

**Files:** None (verification only)

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Fix any type errors**

If there are errors, fix them following the error messages.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type errors from security features"
```

---

## Task 13: Run E2E Tests

**Files:** None (verification only)

**Step 1: Start dev server**

Run: `npm run dev` (in background)

**Step 2: Run login E2E tests**

Run: `npx playwright test tests/e2e/auth/login.spec.ts`
Expected: Tests pass (many were written expecting these features)

**Step 3: Investigate and fix failures**

If tests fail, read the error messages and fix issues.

**Step 4: Commit any test fixes**

```bash
git add -A
git commit -m "fix: resolve E2E test issues"
```

---

## Summary

After completing all tasks, you will have:

1. **Audit Logging** - All security events tracked in database
2. **Account Lockout** - Brute-force protection with 5 attempts / 15 min lockout
3. **Remember Me** - 30-day persistent sessions with token rotation
4. **Admin Tools** - Unlock accounts, view/revoke sessions
5. **Full Integration** - Login flow updated, logout revokes tokens, middleware checks remember-me

Files created:
- `src/lib/config/security.ts`
- `src/lib/audit.ts`
- `src/lib/auth/lockout.ts`
- `src/lib/auth/remember-me.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/api/users/[id]/unlock/route.ts`
- `src/app/api/users/[id]/sessions/route.ts`

Files modified:
- `prisma/schema.prisma`
- `src/lib/validations.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/components/auth/login-form.tsx`
