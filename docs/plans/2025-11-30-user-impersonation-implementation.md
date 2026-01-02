# User Impersonation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable admins to temporarily assume another user's identity for debugging and support.

**Architecture:** Extend iron-session's SessionData with impersonation fields. When impersonating, session reflects target user but preserves original admin. Helper functions check impersonation state and auto-expire after 1 hour.

**Tech Stack:** Next.js 14, iron-session, Prisma, TypeScript

---

## Task 1: Update SessionData Type

**Files:**
- Modify: `src/types/auth.ts`

**Step 1: Add impersonation fields to SessionData**

```typescript
// Add after existing SessionData interface (around line 46-51)
export interface ImpersonationData {
  originalUserId: string
  originalEmail: string
  originalRole: Role
  startedAt: number // Unix timestamp
}

export interface SessionData {
  userId: string
  email: string
  role: Role
  isLoggedIn: boolean
  impersonating?: ImpersonationData
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/auth.ts
git commit -m "feat(types): add impersonation fields to SessionData"
```

---

## Task 2: Add Impersonation Config

**Files:**
- Modify: `src/lib/config/security.ts`

**Step 1: Add impersonation config**

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
  twoFactor: {
    issuer: 'SocleStack',
    backupCodeCount: 10,
    pendingTokenExpiryMinutes: 5,
  },
  impersonation: {
    timeoutMinutes: 60,
  },
} as const;
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/config/security.ts
git commit -m "feat(config): add impersonation timeout setting"
```

---

## Task 3: Add Audit Events

**Files:**
- Modify: `src/lib/audit.ts`

**Step 1: Add impersonation audit actions**

Add to the `AuditAction` type (after `ADMIN_2FA_RESET`):

```typescript
export type AuditAction =
  // ... existing actions ...
  | 'ADMIN_2FA_RESET'
  // Impersonation
  | 'ADMIN_IMPERSONATION_START'
  | 'ADMIN_IMPERSONATION_END'
  | 'ADMIN_IMPERSONATION_EXPIRED';
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat(audit): add impersonation audit event types"
```

---

## Task 4: Create Impersonation Service

**Files:**
- Create: `src/lib/auth/impersonation.ts`

**Step 1: Create the impersonation service**

```typescript
import { IronSession } from 'iron-session';
import { SessionData, ImpersonationData } from '@/types/auth';
import { SECURITY_CONFIG } from '@/lib/config/security';

const { timeoutMinutes } = SECURITY_CONFIG.impersonation;

/**
 * Check if the session is currently impersonating a user
 */
export function isImpersonating(session: IronSession<SessionData>): boolean {
  return !!session.impersonating;
}

/**
 * Check if impersonation has expired (past timeout)
 */
export function hasImpersonationExpired(session: IronSession<SessionData>): boolean {
  if (!session.impersonating) {
    return false;
  }

  const elapsed = Date.now() - session.impersonating.startedAt;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  return elapsed > timeoutMs;
}

/**
 * Get remaining impersonation time in minutes
 */
export function getImpersonationTimeRemaining(session: IronSession<SessionData>): number {
  if (!session.impersonating) {
    return 0;
  }

  const elapsed = Date.now() - session.impersonating.startedAt;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const remainingMs = Math.max(0, timeoutMs - elapsed);

  return Math.ceil(remainingMs / (60 * 1000));
}

/**
 * Get the original admin info if impersonating
 */
export function getOriginalAdmin(session: IronSession<SessionData>): ImpersonationData | null {
  return session.impersonating || null;
}

/**
 * Calculate impersonation duration in seconds
 */
export function getImpersonationDuration(session: IronSession<SessionData>): number {
  if (!session.impersonating) {
    return 0;
  }

  return Math.floor((Date.now() - session.impersonating.startedAt) / 1000);
}

/**
 * Assert that the session is not impersonating (throws if it is)
 */
export function assertNotImpersonating(session: IronSession<SessionData>): void {
  if (isImpersonating(session)) {
    throw new ImpersonationBlockedError();
  }
}

/**
 * Error thrown when an action is blocked during impersonation
 */
export class ImpersonationBlockedError extends Error {
  constructor() {
    super('This action is not allowed while impersonating a user');
    this.name = 'ImpersonationBlockedError';
  }
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/auth/impersonation.ts
git commit -m "feat(auth): add impersonation helper functions"
```

---

## Task 5: Create Start Impersonation API Route

**Files:**
- Create: `src/app/api/admin/impersonate/route.ts`

**Step 1: Create the impersonate endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, getClientIP } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { isImpersonating } from '@/lib/auth/impersonation';

export const runtime = 'nodejs';

const impersonateSchema = z.object({
  userId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    // Must be logged in
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Cannot start impersonation while already impersonating
    if (isImpersonating(session)) {
      return NextResponse.json(
        { error: { type: 'FORBIDDEN', message: 'Already impersonating a user. Exit first.' } },
        { status: 403 }
      );
    }

    // Must be ADMIN
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const result = impersonateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Invalid request', details: result.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const { userId: targetUserId } = result.data;

    // Cannot impersonate yourself
    if (targetUserId === session.userId) {
      return NextResponse.json(
        { error: { type: 'FORBIDDEN', message: 'Cannot impersonate yourself' } },
        { status: 403 }
      );
    }

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { error: { type: 'FORBIDDEN', message: 'Cannot impersonate inactive user' } },
        { status: 403 }
      );
    }

    // Cannot impersonate another ADMIN
    if (targetUser.role === 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'FORBIDDEN', message: 'Cannot impersonate another admin' } },
        { status: 403 }
      );
    }

    // Store original admin info and switch to target user
    const originalUserId = session.userId;
    const originalEmail = session.email;
    const originalRole = session.role;

    session.impersonating = {
      originalUserId,
      originalEmail,
      originalRole,
      startedAt: Date.now(),
    };

    session.userId = targetUser.id;
    session.email = targetUser.email;
    session.role = targetUser.role;

    await session.save();

    // Log audit event
    await logAuditEvent({
      action: 'ADMIN_IMPERSONATION_START',
      category: 'admin',
      userId: originalUserId,
      ipAddress: clientIP,
      userAgent,
      metadata: {
        adminUserId: originalUserId,
        adminEmail: originalEmail,
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        role: targetUser.role,
      },
    });
  } catch (error) {
    console.error('Impersonation error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to start impersonation' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/admin/impersonate/route.ts
git commit -m "feat(api): add impersonate endpoint"
```

---

## Task 6: Create Exit Impersonation API Route

**Files:**
- Create: `src/app/api/admin/exit-impersonation/route.ts`

**Step 1: Create the exit-impersonation endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { isImpersonating, getImpersonationDuration } from '@/lib/auth/impersonation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    // Must be logged in
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Must be impersonating
    if (!isImpersonating(session)) {
      return NextResponse.json(
        { error: { type: 'FORBIDDEN', message: 'Not currently impersonating' } },
        { status: 403 }
      );
    }

    const impersonating = session.impersonating!;
    const duration = getImpersonationDuration(session);
    const targetUserId = session.userId;
    const targetEmail = session.email;

    // Restore original admin session
    session.userId = impersonating.originalUserId;
    session.email = impersonating.originalEmail;
    session.role = impersonating.originalRole;
    session.impersonating = undefined;

    await session.save();

    // Log audit event
    await logAuditEvent({
      action: 'ADMIN_IMPERSONATION_END',
      category: 'admin',
      userId: impersonating.originalUserId,
      ipAddress: clientIP,
      userAgent,
      metadata: {
        adminUserId: impersonating.originalUserId,
        adminEmail: impersonating.originalEmail,
        targetUserId,
        targetEmail,
        durationSeconds: duration,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: impersonating.originalUserId,
        email: impersonating.originalEmail,
        role: impersonating.originalRole,
      },
    });
  } catch (error) {
    console.error('Exit impersonation error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to exit impersonation' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/admin/exit-impersonation/route.ts
git commit -m "feat(api): add exit-impersonation endpoint"
```

---

## Task 7: Update Session Endpoint for Impersonation

**Files:**
- Modify: `src/app/api/auth/session/route.ts`

**Step 1: Add impersonation info to session response**

Add imports at top:

```typescript
import { isImpersonating, hasImpersonationExpired, getImpersonationTimeRemaining, getImpersonationDuration } from '@/lib/auth/impersonation';
import { logAuditEvent } from '@/lib/audit';
```

After line 16 (after `if (session.isLoggedIn && session.userId) {`), add impersonation expiry check:

```typescript
    // Check existing session first
    const session = await getSession();
    if (session.isLoggedIn && session.userId) {
      // Check if impersonation has expired
      if (isImpersonating(session) && hasImpersonationExpired(session)) {
        const impersonating = session.impersonating!;
        const duration = getImpersonationDuration(session);
        const targetUserId = session.userId;
        const targetEmail = session.email;

        // Restore original admin
        session.userId = impersonating.originalUserId;
        session.email = impersonating.originalEmail;
        session.role = impersonating.originalRole;
        session.impersonating = undefined;
        await session.save();

        // Log expiry
        await logAuditEvent({
          action: 'ADMIN_IMPERSONATION_EXPIRED',
          category: 'admin',
          userId: impersonating.originalUserId,
          ipAddress: clientIP,
          userAgent,
          metadata: {
            adminUserId: impersonating.originalUserId,
            adminEmail: impersonating.originalEmail,
            targetUserId,
            targetEmail,
            durationSeconds: duration,
          },
        });
      }

      const user = await prisma.user.findUnique({
        // ... existing code
      });
```

Update the response (around line 32) to include impersonation info:

```typescript
      if (user) {
        const response: Record<string, unknown> = { user, authenticated: true };

        if (isImpersonating(session)) {
          response.impersonating = {
            originalEmail: session.impersonating!.originalEmail,
            timeRemainingMinutes: getImpersonationTimeRemaining(session),
          };
        }

        return NextResponse.json(response);
      }
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/auth/session/route.ts
git commit -m "feat(api): add impersonation info to session endpoint"
```

---

## Task 8: Block Security Actions During Impersonation - 2FA Setup

**Files:**
- Modify: `src/app/api/auth/2fa/setup/route.ts`

**Step 1: Add impersonation check**

Add import at top:

```typescript
import { assertNotImpersonating, ImpersonationBlockedError } from '@/lib/auth/impersonation';
```

After session check (around line 13), add:

```typescript
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Block during impersonation
    try {
      assertNotImpersonating(session);
    } catch (error) {
      if (error instanceof ImpersonationBlockedError) {
        return NextResponse.json(
          { error: { type: 'FORBIDDEN', message: error.message } },
          { status: 403 }
        );
      }
      throw error;
    }
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/auth/2fa/setup/route.ts
git commit -m "feat(2fa): block setup during impersonation"
```

---

## Task 9: Block Security Actions During Impersonation - 2FA Verify

**Files:**
- Modify: `src/app/api/auth/2fa/verify/route.ts`

**Step 1: Add impersonation check**

Add import at top:

```typescript
import { assertNotImpersonating, ImpersonationBlockedError } from '@/lib/auth/impersonation';
```

After session check, add impersonation block (same pattern as Task 8):

```typescript
    // Block during impersonation
    try {
      assertNotImpersonating(session);
    } catch (error) {
      if (error instanceof ImpersonationBlockedError) {
        return NextResponse.json(
          { error: { type: 'FORBIDDEN', message: error.message } },
          { status: 403 }
        );
      }
      throw error;
    }
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/auth/2fa/verify/route.ts
git commit -m "feat(2fa): block verify during impersonation"
```

---

## Task 10: Block Security Actions During Impersonation - 2FA Disable

**Files:**
- Modify: `src/app/api/auth/2fa/disable/route.ts`

**Step 1: Add impersonation check**

Add import at top:

```typescript
import { assertNotImpersonating, ImpersonationBlockedError } from '@/lib/auth/impersonation';
```

After session check, add impersonation block (same pattern as Task 8).

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/auth/2fa/disable/route.ts
git commit -m "feat(2fa): block disable during impersonation"
```

---

## Task 11: Create Impersonation Banner Component

**Files:**
- Create: `src/components/admin/impersonation-banner.tsx`

**Step 1: Create the banner component**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ImpersonationBannerProps {
  targetEmail: string
  timeRemainingMinutes: number
}

export function ImpersonationBanner({ targetEmail, timeRemainingMinutes: initialTime }: ImpersonationBannerProps) {
  const router = useRouter()
  const [timeRemaining, setTimeRemaining] = useState(initialTime)
  const [isExiting, setIsExiting] = useState(false)

  // Update timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time expired, refresh to trigger session restore
          router.refresh()
          return 0
        }
        return prev - 1
      })
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [router])

  const handleExit = async () => {
    setIsExiting(true)

    try {
      const response = await fetch('/api/admin/exit-impersonation', {
        method: 'POST',
      })

      if (response.ok) {
        router.refresh()
      } else {
        setIsExiting(false)
        console.error('Failed to exit impersonation')
      }
    } catch (error) {
      setIsExiting(false)
      console.error('Exit impersonation error:', error)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">
            Impersonating <strong>{targetEmail}</strong>
          </span>
          <span className="text-amber-800">
            • {timeRemaining} min remaining
          </span>
        </div>
        <button
          onClick={handleExit}
          disabled={isExiting}
          className="px-3 py-1 bg-amber-700 text-white rounded hover:bg-amber-800 disabled:opacity-50 text-sm font-medium"
        >
          {isExiting ? 'Exiting...' : 'Exit Impersonation'}
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/admin/impersonation-banner.tsx
git commit -m "feat(ui): add impersonation banner component"
```

---

## Task 12: Create Impersonation Banner Wrapper

**Files:**
- Create: `src/components/admin/impersonation-banner-wrapper.tsx`

**Step 1: Create server component wrapper**

```typescript
import { getSession } from '@/lib/auth'
import { isImpersonating, getImpersonationTimeRemaining } from '@/lib/auth/impersonation'
import { ImpersonationBanner } from './impersonation-banner'

export async function ImpersonationBannerWrapper() {
  const session = await getSession()

  if (!session.isLoggedIn || !isImpersonating(session)) {
    return null
  }

  return (
    <ImpersonationBanner
      targetEmail={session.email}
      timeRemainingMinutes={getImpersonationTimeRemaining(session)}
    />
  )
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/admin/impersonation-banner-wrapper.tsx
git commit -m "feat(ui): add impersonation banner server wrapper"
```

---

## Task 13: Add Banner to Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Add banner to layout**

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ImpersonationBannerWrapper } from "@/components/admin/impersonation-banner-wrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SocleStack - Next.js User Management",
      description: "A complete Next.js application with Enterprise-grade user management features",};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ImpersonationBannerWrapper />
        {children}
      </body>
    </html>
  );
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(ui): add impersonation banner to root layout"
```

---

## Task 14: Verify Build

**Step 1: Run production build**

Run: `npm run build`
Expected: Build completes successfully

**Step 2: Fix any lint or type errors**

If errors occur, fix them and re-run build.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors"
```

---

## Task 15: Update PROGRESS.md

**Files:**
- Modify: `docs/PROGRESS.md`

**Step 1: Add impersonation to completed work**

Add after the 2FA section:

```markdown
### User Impersonation (Switch User) ✅
*Completed 2025-11-30*

**Core Features:**
- Admins can impersonate any non-admin user
- Session preserves original admin identity
- 1-hour timeout with auto-expiry
- Sticky amber banner shows impersonation status

**Security:**
- Cannot impersonate other ADMINs
- Security actions blocked during impersonation (2FA, password)
- Full audit trail (start, end, expired events)

**API Endpoints:**
- `POST /api/admin/impersonate` - Start impersonation
- `POST /api/admin/exit-impersonation` - End impersonation

**UI:**
- Impersonation banner at top of all pages
- Shows target user, time remaining, exit button
```

**Step 2: Commit**

```bash
git add docs/PROGRESS.md
git commit -m "docs: add impersonation to PROGRESS.md"
```
