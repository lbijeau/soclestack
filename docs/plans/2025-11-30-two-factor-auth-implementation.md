# Two-Factor Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add TOTP-based two-factor authentication with backup codes, required for admins, optional for others.

**Architecture:** Extend existing auth flow with 2FA check after password validation. Store encrypted TOTP secrets and hashed backup codes in database. Use short-lived pending tokens between password and 2FA steps.

**Tech Stack:** otpauth (TOTP), qrcode (QR generation), Prisma (SQLite), Next.js 14 App Router, TypeScript, bcryptjs

---

## Task 1: Install Dependencies

**Files:** None (package.json updated by npm)

**Step 1: Install otpauth and qrcode**

Run:
```bash
npm install otpauth qrcode
npm install -D @types/qrcode
```

Expected: Packages added to package.json

**Step 2: Verify installation**

Run: `npm ls otpauth qrcode`
Expected: Both packages listed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add otpauth and qrcode dependencies for 2FA"
```

---

## Task 2: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add 2FA fields to User model**

In `prisma/schema.prisma`, add these fields to the User model after the lockout fields (around line 32):

```prisma
  // Two-factor authentication
  twoFactorSecret    String?   @map("two_factor_secret")
  twoFactorEnabled   Boolean   @default(false) @map("two_factor_enabled")
  twoFactorVerified  Boolean   @default(false) @map("two_factor_verified")
  backupCodes        BackupCode[]
```

**Step 2: Add BackupCode model**

Add this model at the end of the file (after RememberMeToken):

```prisma
model BackupCode {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash  String    @map("code_hash")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@map("backup_codes")
}
```

**Step 3: Push schema changes**

Run: `npx prisma db push`
Expected: Database updated successfully

**Step 4: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add 2FA fields and BackupCode model"
```

---

## Task 3: Add 2FA Audit Events

**Files:**
- Modify: `src/lib/audit.ts`

**Step 1: Add 2FA audit actions**

In `src/lib/audit.ts`, update the `AuditAction` type to add these actions after `SECURITY_ALL_SESSIONS_REVOKED`:

```typescript
  // Two-factor authentication
  | 'AUTH_2FA_ENABLED'
  | 'AUTH_2FA_DISABLED'
  | 'AUTH_2FA_SUCCESS'
  | 'AUTH_2FA_FAILURE'
  | 'AUTH_2FA_BACKUP_USED'
  | 'ADMIN_2FA_RESET';
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat(audit): add 2FA audit event types"
```

---

## Task 4: Update Security Config

**Files:**
- Modify: `src/lib/config/security.ts`

**Step 1: Read current config**

Read `src/lib/config/security.ts` to see current structure.

**Step 2: Add 2FA configuration**

Add to the SECURITY_CONFIG object:

```typescript
  twoFactor: {
    issuer: 'SocleStack',
    backupCodeCount: 10,
    pendingTokenExpiryMinutes: 5,
  },
```

**Step 3: Commit**

```bash
git add src/lib/config/security.ts
git commit -m "feat(config): add 2FA configuration constants"
```

---

## Task 5: Create TOTP Service

**Files:**
- Create: `src/lib/auth/totp.ts`

**Step 1: Create the TOTP service file**

Create `src/lib/auth/totp.ts`:

```typescript
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { SECURITY_CONFIG } from '../config/security';

const { issuer } = SECURITY_CONFIG.twoFactor;

export interface TOTPSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
}

export async function generateTOTPSecret(email: string): Promise<TOTPSetupResult> {
  const totp = new OTPAuth.TOTP({
    issuer,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const otpauthUrl = totp.toString();

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return {
    secret,
    qrCodeDataUrl,
    manualEntryKey: secret,
  };
}

export function verifyTOTPCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Allow 1 period window (30 seconds) in either direction
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/auth/totp.ts
git commit -m "feat(auth): implement TOTP generation and validation"
```

---

## Task 6: Create Backup Codes Service

**Files:**
- Create: `src/lib/auth/backup-codes.ts`

**Step 1: Create the backup codes service file**

Create `src/lib/auth/backup-codes.ts`:

```typescript
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { SECURITY_CONFIG } from '../config/security';

const { backupCodeCount } = SECURITY_CONFIG.twoFactor;

function generateCode(): string {
  // Generate 8-character alphanumeric code (easy to read/type)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function generateBackupCodes(userId: string): Promise<string[]> {
  // Delete existing backup codes
  await prisma.backupCode.deleteMany({
    where: { userId },
  });

  const codes: string[] = [];

  for (let i = 0; i < backupCodeCount; i++) {
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);

    await prisma.backupCode.create({
      data: {
        userId,
        codeHash,
      },
    });

    codes.push(code);
  }

  return codes;
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  // Normalize: uppercase, remove spaces/dashes
  const normalizedCode = code.toUpperCase().replace(/[\s-]/g, '');

  const backupCodes = await prisma.backupCode.findMany({
    where: {
      userId,
      usedAt: null, // Only unused codes
    },
  });

  for (const backupCode of backupCodes) {
    const isMatch = await bcrypt.compare(normalizedCode, backupCode.codeHash);
    if (isMatch) {
      // Mark as used
      await prisma.backupCode.update({
        where: { id: backupCode.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }

  return false;
}

export async function getRemainingBackupCodeCount(userId: string): Promise<number> {
  return prisma.backupCode.count({
    where: {
      userId,
      usedAt: null,
    },
  });
}

export async function deleteAllBackupCodes(userId: string): Promise<void> {
  await prisma.backupCode.deleteMany({
    where: { userId },
  });
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/auth/backup-codes.ts
git commit -m "feat(auth): implement backup codes generation and validation"
```

---

## Task 7: Create Pending 2FA Token Service

**Files:**
- Create: `src/lib/auth/pending-2fa.ts`

**Step 1: Create the pending 2FA token service**

Create `src/lib/auth/pending-2fa.ts`:

```typescript
import jwt from 'jsonwebtoken';
import { SECURITY_CONFIG } from '../config/security';

const { pendingTokenExpiryMinutes } = SECURITY_CONFIG.twoFactor;

interface Pending2FAPayload {
  userId: string;
  email: string;
  type: 'pending_2fa';
  iat: number;
  exp: number;
}

export function createPending2FAToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign(
    { userId, email, type: 'pending_2fa' },
    secret,
    { expiresIn: `${pendingTokenExpiryMinutes}m` }
  );
}

export function verifyPending2FAToken(token: string): { userId: string; email: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  try {
    const payload = jwt.verify(token, secret) as Pending2FAPayload;
    if (payload.type !== 'pending_2fa') {
      return null;
    }
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/auth/pending-2fa.ts
git commit -m "feat(auth): implement pending 2FA token for login flow"
```

---

## Task 8: Create 2FA Setup API Route

**Files:**
- Create: `src/app/api/auth/2fa/setup/route.ts`

**Step 1: Create directory structure**

Run: `mkdir -p src/app/api/auth/2fa/setup`

**Step 2: Create the setup route**

Create `src/app/api/auth/2fa/setup/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateTOTPSecret } from '@/lib/auth/totp';
import { generateBackupCodes } from '@/lib/auth/backup-codes';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: { type: 'CONFLICT', message: '2FA is already enabled' } },
        { status: 409 }
      );
    }

    // Generate TOTP secret and QR code
    const totpResult = await generateTOTPSecret(user.email);

    // Generate backup codes
    const backupCodes = await generateBackupCodes(session.userId);

    // Store secret (not enabled yet, needs verification)
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorSecret: totpResult.secret,
        twoFactorEnabled: false,
        twoFactorVerified: false,
      },
    });

    return NextResponse.json({
      qrCodeDataUrl: totpResult.qrCodeDataUrl,
      manualEntryKey: totpResult.manualEntryKey,
      backupCodes,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to setup 2FA' } },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/auth/2fa/setup/route.ts
git commit -m "feat(api): add 2FA setup endpoint"
```

---

## Task 9: Create 2FA Verify API Route

**Files:**
- Create: `src/app/api/auth/2fa/verify/route.ts`

**Step 1: Create the verify route**

Create `src/app/api/auth/2fa/verify/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { verifyTOTPCode } from '@/lib/auth/totp';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = verifySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Invalid code format' } },
        { status: 400 }
      );
    }

    const { code } = validationResult.data;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: { type: 'BAD_REQUEST', message: '2FA setup not started' } },
        { status: 400 }
      );
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: { type: 'CONFLICT', message: '2FA is already enabled' } },
        { status: 409 }
      );
    }

    const isValid = verifyTOTPCode(user.twoFactorSecret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Invalid code' } },
        { status: 401 }
      );
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorVerified: true,
      },
    });

    await logAuditEvent({
      action: 'AUTH_2FA_ENABLED',
      category: 'security',
      userId: session.userId,
      ipAddress: clientIP,
      userAgent,
    });

    return NextResponse.json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA verify error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to verify 2FA' } },
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
git add src/app/api/auth/2fa/verify/route.ts
git commit -m "feat(api): add 2FA verification endpoint to complete setup"
```

---

## Task 10: Create 2FA Validate API Route (Login Flow)

**Files:**
- Create: `src/app/api/auth/2fa/validate/route.ts`

**Step 1: Create the validate route**

Create `src/app/api/auth/2fa/validate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createUserSession, getClientIP } from '@/lib/auth';
import { verifyTOTPCode } from '@/lib/auth/totp';
import { verifyBackupCode, getRemainingBackupCodeCount } from '@/lib/auth/backup-codes';
import { verifyPending2FAToken } from '@/lib/auth/pending-2fa';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';

const validateSchema = z.object({
  pendingToken: z.string(),
  code: z.string().min(6).max(8), // 6 for TOTP, 8 for backup
  isBackupCode: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const body = await req.json();
    const validationResult = validateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Invalid request' } },
        { status: 400 }
      );
    }

    const { pendingToken, code, isBackupCode } = validationResult.data;

    // Verify pending token
    const pending = verifyPending2FAToken(pendingToken);
    if (!pending) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Session expired, please login again' } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: pending.userId },
    });

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Invalid session' } },
        { status: 401 }
      );
    }

    let isValid = false;
    let usedBackupCode = false;

    if (isBackupCode) {
      isValid = await verifyBackupCode(user.id, code);
      usedBackupCode = isValid;
    } else {
      isValid = verifyTOTPCode(user.twoFactorSecret, code);
    }

    if (!isValid) {
      await logAuditEvent({
        action: 'AUTH_2FA_FAILURE',
        category: 'authentication',
        userId: user.id,
        ipAddress: clientIP,
        userAgent,
        metadata: { isBackupCode },
      });

      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Invalid code' } },
        { status: 401 }
      );
    }

    // Create full session
    const tokens = await createUserSession(user, clientIP, userAgent);

    // Log success
    if (usedBackupCode) {
      const remainingCodes = await getRemainingBackupCodeCount(user.id);
      await logAuditEvent({
        action: 'AUTH_2FA_BACKUP_USED',
        category: 'authentication',
        userId: user.id,
        ipAddress: clientIP,
        userAgent,
        metadata: { remainingCodes },
      });
    } else {
      await logAuditEvent({
        action: 'AUTH_2FA_SUCCESS',
        category: 'authentication',
        userId: user.id,
        ipAddress: clientIP,
        userAgent,
      });
    }

    // Check remaining backup codes
    const remainingBackupCodes = await getRemainingBackupCodeCount(user.id);

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      warnings: remainingBackupCodes <= 3 ? {
        lowBackupCodes: true,
        remainingBackupCodes,
      } : undefined,
    });
  } catch (error) {
    console.error('2FA validate error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to validate 2FA' } },
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
git add src/app/api/auth/2fa/validate/route.ts
git commit -m "feat(api): add 2FA validation endpoint for login flow"
```

---

## Task 11: Create 2FA Disable API Route

**Files:**
- Create: `src/app/api/auth/2fa/disable/route.ts`

**Step 1: Create the disable route**

Create `src/app/api/auth/2fa/disable/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { verifyTOTPCode } from '@/lib/auth/totp';
import { deleteAllBackupCodes } from '@/lib/auth/backup-codes';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';

const disableSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = disableSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Invalid code format' } },
        { status: 400 }
      );
    }

    const { code } = validationResult.data;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Admins cannot disable their own 2FA
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'FORBIDDEN', message: 'Admins cannot disable 2FA' } },
        { status: 403 }
      );
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: { type: 'BAD_REQUEST', message: '2FA is not enabled' } },
        { status: 400 }
      );
    }

    // Verify current TOTP code
    const isValid = verifyTOTPCode(user.twoFactorSecret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Invalid code' } },
        { status: 401 }
      );
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorVerified: false,
      },
    });

    // Delete backup codes
    await deleteAllBackupCodes(session.userId);

    await logAuditEvent({
      action: 'AUTH_2FA_DISABLED',
      category: 'security',
      userId: session.userId,
      ipAddress: clientIP,
      userAgent,
    });

    return NextResponse.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to disable 2FA' } },
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
git add src/app/api/auth/2fa/disable/route.ts
git commit -m "feat(api): add 2FA disable endpoint"
```

---

## Task 12: Create Admin 2FA Reset API Route

**Files:**
- Create: `src/app/api/admin/users/[id]/reset-2fa/route.ts`

**Step 1: Create directory structure**

Run: `mkdir -p src/app/api/admin/users/[id]/reset-2fa`

**Step 2: Create the admin reset route**

Create `src/app/api/admin/users/[id]/reset-2fa/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { deleteAllBackupCodes } from '@/lib/auth/backup-codes';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const { id: targetUserId } = await params;
    const session = await getSession();

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

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, twoFactorEnabled: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!targetUser.twoFactorEnabled) {
      return NextResponse.json(
        { error: { type: 'BAD_REQUEST', message: '2FA is not enabled for this user' } },
        { status: 400 }
      );
    }

    // Reset 2FA
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorVerified: false,
      },
    });

    // Delete backup codes
    await deleteAllBackupCodes(targetUserId);

    await logAuditEvent({
      action: 'ADMIN_2FA_RESET',
      category: 'admin',
      userId: targetUserId,
      ipAddress: clientIP,
      userAgent,
      metadata: { resetBy: session.userId, targetEmail: targetUser.email },
    });

    return NextResponse.json({ message: '2FA reset successfully' });
  } catch (error) {
    console.error('Admin 2FA reset error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to reset 2FA' } },
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
git add src/app/api/admin/users/[id]/reset-2fa/route.ts
git commit -m "feat(admin): add endpoint to reset user 2FA"
```

---

## Task 13: Update Login Route for 2FA

**Files:**
- Modify: `src/app/api/auth/login/route.ts`

**Step 1: Add pending 2FA token import**

At the top of `src/app/api/auth/login/route.ts`, add:

```typescript
import { createPending2FAToken } from '@/lib/auth/pending-2fa'
```

**Step 2: Add 2FA check after password validation**

After the successful authentication check and before session creation (around line 148), add the 2FA check. Find this section:

```typescript
    // Reset failed attempts on successful login
    await resetFailedAttempts(authenticatedUser.id)

    // Create session
    const tokens = await createUserSession(authenticatedUser, clientIP, userAgent)
```

Replace with:

```typescript
    // Reset failed attempts on successful login
    await resetFailedAttempts(authenticatedUser.id)

    // Check if 2FA is enabled
    if (authenticatedUser.twoFactorEnabled) {
      const pendingToken = createPending2FAToken(authenticatedUser.id, authenticatedUser.email)

      await logAuditEvent({
        action: 'AUTH_LOGIN_SUCCESS',
        category: 'authentication',
        userId: authenticatedUser.id,
        ipAddress: clientIP,
        userAgent,
        metadata: { requires2FA: true },
      })

      return NextResponse.json({
        requiresTwoFactor: true,
        pendingToken,
      })
    }

    // Create session (no 2FA)
    const tokens = await createUserSession(authenticatedUser, clientIP, userAgent)
```

**Step 3: Update User query to include 2FA field**

Find the `prisma.user.findUnique` call that gets the user (around line 54) and ensure the query includes `twoFactorEnabled`. The `authenticateUser` function should already return the full user, but verify it includes this field.

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/auth/login/route.ts
git commit -m "feat(auth): integrate 2FA into login flow"
```

---

## Task 14: Create Two-Factor Input Component

**Files:**
- Create: `src/components/auth/two-factor-input.tsx`

**Step 1: Create the component**

Create `src/components/auth/two-factor-input.tsx`:

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

interface TwoFactorInputProps {
  onSubmit: (code: string, isBackupCode: boolean) => Promise<void>
  onCancel: () => void
  isLoading: boolean
  error?: string
}

export function TwoFactorInput({ onSubmit, onCancel, isLoading, error }: TwoFactorInputProps) {
  const [code, setCode] = useState('')
  const [isBackupMode, setIsBackupMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [isBackupMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(code, isBackupMode)
  }

  const toggleBackupMode = () => {
    setIsBackupMode(!isBackupMode)
    setCode('')
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">
          {isBackupMode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {isBackupMode
            ? 'Enter one of your backup codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>
      </div>

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            ref={inputRef}
            type="text"
            inputMode={isBackupMode ? 'text' : 'numeric'}
            pattern={isBackupMode ? '[A-Za-z0-9]{8}' : '[0-9]{6}'}
            maxLength={isBackupMode ? 8 : 6}
            placeholder={isBackupMode ? 'XXXXXXXX' : '000000'}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={isLoading}
            className="text-center text-2xl tracking-widest"
            autoComplete="one-time-code"
            data-testid="2fa-code-input"
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || (isBackupMode ? code.length !== 8 : code.length !== 6)}
            className="flex-1"
            data-testid="2fa-submit"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={toggleBackupMode}
          className="text-sm text-blue-600 hover:text-blue-500"
          disabled={isLoading}
        >
          {isBackupMode ? 'Use authenticator app instead' : 'Use backup code'}
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
git add src/components/auth/two-factor-input.tsx
git commit -m "feat(ui): add two-factor code input component"
```

---

## Task 15: Update Login Form for 2FA

**Files:**
- Modify: `src/components/auth/login-form.tsx`

**Step 1: Add imports and state**

At the top of `src/components/auth/login-form.tsx`, add:

```typescript
import { TwoFactorInput } from './two-factor-input'
```

Add new state variables after the existing state declarations:

```typescript
  const [requires2FA, setRequires2FA] = useState(false)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [twoFactorError, setTwoFactorError] = useState('')
```

**Step 2: Update handleSubmit for 2FA response**

In the success path of handleSubmit (after `if (!response.ok)`), check for 2FA requirement:

```typescript
      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        setRequires2FA(true)
        setPendingToken(data.pendingToken)
        return
      }

      // Store tokens (existing code)
```

**Step 3: Add 2FA submission handler**

Add this function after handleSubmit:

```typescript
  const handle2FASubmit = async (code: string, isBackupCode: boolean) => {
    setIsLoading(true)
    setTwoFactorError('')

    try {
      const response = await fetch('/api/auth/2fa/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pendingToken,
          code,
          isBackupCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setTwoFactorError(data.error?.message || 'Invalid code')
        return
      }

      // Store tokens
      if (data.tokens) {
        localStorage.setItem('accessToken', data.tokens.accessToken)
        localStorage.setItem('refreshToken', data.tokens.refreshToken)
      }

      // Show warning if low on backup codes
      if (data.warnings?.lowBackupCodes) {
        alert(`Warning: You only have ${data.warnings.remainingBackupCodes} backup codes remaining. Consider regenerating them.`)
      }

      // Redirect
      router.push(returnUrl)
      router.refresh()

    } catch {
      setTwoFactorError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel2FA = () => {
    setRequires2FA(false)
    setPendingToken(null)
    setTwoFactorError('')
    setFormData({ email: '', password: '', rememberMe: false })
  }
```

**Step 4: Update the render for 2FA screen**

Wrap the form return in a conditional. Replace the return statement:

```typescript
  if (requires2FA) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Verify your identity to complete sign in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorInput
            onSubmit={handle2FASubmit}
            onCancel={handleCancel2FA}
            isLoading={isLoading}
            error={twoFactorError}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    // ... existing Card component
  )
```

**Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/auth/login-form.tsx
git commit -m "feat(ui): integrate 2FA into login form"
```

---

## Task 16: Create Security Settings Page

**Files:**
- Create: `src/app/(dashboard)/profile/security/page.tsx`

**Step 1: Create directory**

Run: `mkdir -p src/app/\(dashboard\)/profile/security`

**Step 2: Create the page**

Create `src/app/(dashboard)/profile/security/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SecuritySettings } from '@/components/profile/security-settings'

export default async function SecurityPage() {
  const session = await getSession()

  if (!session.isLoggedIn || !session.userId) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      role: true,
      twoFactorEnabled: true,
      _count: {
        select: {
          backupCodes: {
            where: { usedAt: null },
          },
        },
      },
    },
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Security Settings</h1>

      <SecuritySettings
        twoFactorEnabled={user.twoFactorEnabled}
        isAdmin={user.role === 'ADMIN'}
        remainingBackupCodes={user._count.backupCodes}
      />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/profile/security/page.tsx
git commit -m "feat(ui): add security settings page"
```

---

## Task 17: Create Security Settings Component

**Files:**
- Create: `src/components/profile/security-settings.tsx`

**Step 1: Create directory**

Run: `mkdir -p src/components/profile`

**Step 2: Create the component**

Create `src/components/profile/security-settings.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { TwoFactorSetup } from './two-factor-setup'

interface SecuritySettingsProps {
  twoFactorEnabled: boolean
  isAdmin: boolean
  remainingBackupCodes: number
}

export function SecuritySettings({ twoFactorEnabled, isAdmin, remainingBackupCodes }: SecuritySettingsProps) {
  const router = useRouter()
  const [showSetup, setShowSetup] = useState(false)
  const [showDisable, setShowDisable] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSetupComplete = () => {
    setShowSetup(false)
    router.refresh()
  }

  const handleDisable = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || 'Failed to disable 2FA')
        return
      }

      setShowDisable(false)
      setDisableCode('')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (showSetup) {
    return <TwoFactorSetup onComplete={handleSetupComplete} onCancel={() => setShowSetup(false)} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && !twoFactorEnabled && (
          <Alert variant="warning">
            Two-factor authentication is required for admin accounts. Please enable it now.
          </Alert>
        )}

        {twoFactorEnabled ? (
          <>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="font-medium text-green-800">2FA is enabled</p>
                <p className="text-sm text-green-600">
                  {remainingBackupCodes} backup codes remaining
                </p>
              </div>
              <span className="text-green-600 text-2xl">✓</span>
            </div>

            {remainingBackupCodes <= 3 && (
              <Alert variant="warning">
                You&apos;re running low on backup codes. Consider regenerating them.
              </Alert>
            )}

            {showDisable ? (
              <div className="space-y-3 p-4 border rounded-lg">
                <p className="text-sm">Enter your current 2FA code to disable:</p>
                {error && <Alert variant="error">{error}</Alert>}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-center text-xl tracking-widest"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDisable(false)
                      setDisableCode('')
                      setError('')
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisable}
                    disabled={isLoading || disableCode.length !== 6}
                  >
                    {isLoading ? 'Disabling...' : 'Disable 2FA'}
                  </Button>
                </div>
              </div>
            ) : (
              !isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => setShowDisable(true)}
                  className="text-red-600 hover:text-red-700"
                >
                  Disable 2FA
                </Button>
              )
            )}

            {isAdmin && (
              <p className="text-sm text-gray-500">
                As an admin, you cannot disable two-factor authentication.
              </p>
            )}
          </>
        ) : (
          <Button onClick={() => setShowSetup(true)}>
            Enable Two-Factor Authentication
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/profile/security-settings.tsx
git commit -m "feat(ui): add security settings component with 2FA management"
```

---

## Task 18: Create Two-Factor Setup Component

**Files:**
- Create: `src/components/profile/two-factor-setup.tsx`

**Step 1: Create the component**

Create `src/components/profile/two-factor-setup.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'

interface TwoFactorSetupProps {
  onComplete: () => void
  onCancel: () => void
}

type Step = 'loading' | 'display' | 'verify'

interface SetupData {
  qrCodeDataUrl: string
  manualEntryKey: string
  backupCodes: string[]
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<Step>('loading')
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  const startSetup = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || 'Failed to start 2FA setup')
        return
      }

      setSetupData(data)
      setStep('display')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const verifySetup = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || 'Invalid code')
        return
      }

      onComplete()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const copyBackupCodes = () => {
    if (setupData) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'))
      setCopiedCodes(true)
    }
  }

  const downloadBackupCodes = () => {
    if (setupData) {
      const content = `SocleStack Backup Codes\n${'='.repeat(20)}\n\n${setupData.backupCodes.join('\n')}\n\nKeep these codes safe. Each code can only be used once.`
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'soclestack-backup-codes.txt'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // Initial loading state - start setup automatically
  if (step === 'loading' && !setupData) {
    startSetup()
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p>Setting up two-factor authentication...</p>
        </CardContent>
      </Card>
    )
  }

  if (step === 'display' && setupData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="space-y-4">
            <h3 className="font-medium">1. Scan QR Code</h3>
            <p className="text-sm text-gray-600">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-center">
              <img
                src={setupData.qrCodeDataUrl}
                alt="2FA QR Code"
                className="border rounded-lg"
              />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-blue-600">Can&apos;t scan? Enter manually</summary>
              <code className="block mt-2 p-2 bg-gray-100 rounded break-all">
                {setupData.manualEntryKey}
              </code>
            </details>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium">2. Save Backup Codes</h3>
            <Alert variant="warning">
              Save these backup codes in a safe place. You won&apos;t be able to see them again!
            </Alert>
            <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-lg font-mono text-sm">
              {setupData.backupCodes.map((code, i) => (
                <div key={i}>{code}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyBackupCodes}>
                {copiedCodes ? 'Copied!' : 'Copy codes'}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadBackupCodes}>
                Download codes
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => setStep('verify')}>
              I&apos;ve saved my backup codes
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'verify') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <p className="text-sm text-gray-600">
            Enter a code from your authenticator app to complete setup.
          </p>

          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            className="w-full px-3 py-2 border rounded text-center text-2xl tracking-widest"
            autoFocus
          />

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('display')}>
              Back
            </Button>
            <Button
              onClick={verifySetup}
              disabled={isLoading || verifyCode.length !== 6}
            >
              {isLoading ? 'Verifying...' : 'Enable 2FA'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/profile/two-factor-setup.tsx
git commit -m "feat(ui): add two-factor setup wizard component"
```

---

## Task 19: Add 2FA Enforcement Middleware

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Update middleware for admin 2FA enforcement**

This is complex because middleware runs in Edge Runtime and can't access Prisma directly. We'll handle this in the security page itself and API routes instead.

For now, we'll add `/profile/security` to the protected routes.

In `src/middleware.ts`, add to the `protectedRoutes` object:

```typescript
  '/profile/security': 'USER',
```

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): add profile/security to protected routes"
```

---

## Task 20: Verify Build and Types

**Files:** None (verification only)

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Fix any errors**

If there are errors, fix them following the error messages.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type errors from 2FA implementation"
```

---

## Task 21: Manual Testing

**Files:** None (testing only)

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test 2FA setup flow**

1. Login as a non-admin user
2. Navigate to `/profile/security`
3. Click "Enable Two-Factor Authentication"
4. Scan QR code with authenticator app
5. Save backup codes
6. Enter code from authenticator app
7. Verify 2FA is enabled

**Step 3: Test 2FA login flow**

1. Logout
2. Login with same user
3. Verify 2FA code input appears
4. Enter code from authenticator app
5. Verify login completes

**Step 4: Test backup code**

1. Logout
2. Login with same user
3. Click "Use backup code"
4. Enter one of the backup codes
5. Verify login completes

**Step 5: Test disable 2FA**

1. Go to `/profile/security`
2. Click "Disable 2FA"
3. Enter code from authenticator app
4. Verify 2FA is disabled

**Step 6: Commit verification**

```bash
git add -A
git commit -m "test: verify 2FA implementation manually"
```

---

## Summary

After completing all tasks, you will have:

1. **TOTP-based 2FA** - Users can enable/disable 2FA with any authenticator app
2. **Backup Codes** - 10 one-time codes for recovery
3. **Modified Login Flow** - Password → 2FA code → session creation
4. **Admin Enforcement** - Admins cannot disable their 2FA
5. **Admin Reset** - Admins can reset other users' 2FA
6. **Security Settings Page** - `/profile/security` for 2FA management

**New files created:**
- `src/lib/auth/totp.ts`
- `src/lib/auth/backup-codes.ts`
- `src/lib/auth/pending-2fa.ts`
- `src/app/api/auth/2fa/setup/route.ts`
- `src/app/api/auth/2fa/verify/route.ts`
- `src/app/api/auth/2fa/validate/route.ts`
- `src/app/api/auth/2fa/disable/route.ts`
- `src/app/api/admin/users/[id]/reset-2fa/route.ts`
- `src/app/(dashboard)/profile/security/page.tsx`
- `src/components/auth/two-factor-input.tsx`
- `src/components/profile/security-settings.tsx`
- `src/components/profile/two-factor-setup.tsx`

**Modified files:**
- `prisma/schema.prisma`
- `src/lib/audit.ts`
- `src/lib/config/security.ts`
- `src/app/api/auth/login/route.ts`
- `src/components/auth/login-form.tsx`
- `src/middleware.ts`
