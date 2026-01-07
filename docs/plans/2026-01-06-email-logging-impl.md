# Email Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email logging infrastructure with admin visibility and retry support.

**Architecture:** Log-first approach where every email creates a database record before delivery attempt. Retry with exponential backoff. Admin UI for debugging.

**Tech Stack:** Prisma (EmailLog model), Next.js API routes, React components with Tailwind

---

## Task 1: Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add EmailStatus enum**

Add after other enums in schema.prisma:

```prisma
enum EmailStatus {
  PENDING
  SENT
  DELIVERED
  FAILED
  BOUNCED
}
```

**Step 2: Add EmailLog model**

Add after User model:

```prisma
model EmailLog {
  id          String      @id @default(cuid())
  to          String
  userId      String?
  user        User?       @relation(fields: [userId], references: [id])
  type        String
  subject     String
  htmlBody    String      @db.Text
  status      EmailStatus @default(PENDING)
  attempts    Int         @default(0)
  lastError   String?
  sentAt      DateTime?
  provider    String      @default("resend")
  providerId  String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([to])
  @@index([userId])
  @@index([status])
  @@index([type])
  @@index([createdAt])
}
```

**Step 3: Add relation to User model**

Find User model and add:

```prisma
emailLogs   EmailLog[]
```

**Step 4: Generate Prisma client**

Run: `npx prisma generate`

**Step 5: Create migration**

Run: `DATABASE_URL="postgresql://soclestack:soclestack123@localhost:5432/soclestack" npx prisma migrate dev --name add_email_log`

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add EmailLog model for email tracking"
```

---

## Task 2: Email Service - Core Logging

**Files:**
- Modify: `src/lib/email.ts`
- Create: `src/lib/email.test.ts`

**Step 1: Write test for sendEmail logging**

Create `src/lib/email.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    emailLog: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'resend_123' }),
    },
  })),
}));

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates email log before sending', async () => {
    const { sendEmail } = await import('./email');

    vi.mocked(prisma.emailLog.create).mockResolvedValue({
      id: 'log_1',
      to: 'test@example.com',
      subject: 'Test',
      htmlBody: '<p>Test</p>',
      type: 'test',
      status: 'PENDING',
      attempts: 0,
      userId: null,
      lastError: null,
      sentAt: null,
      provider: 'resend',
      providerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      type: 'test',
    });

    expect(prisma.emailLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        to: 'test@example.com',
        subject: 'Test',
        status: 'PENDING',
      }),
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/email.test.ts`
Expected: FAIL (sendEmail doesn't have type parameter yet)

**Step 3: Update SendEmailOptions interface**

In `src/lib/email.ts`, update the interface:

```typescript
interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  type: string;
  userId?: string;
}

interface SendEmailResult {
  success: boolean;
  emailLogId?: string;
  error?: string;
}
```

**Step 4: Implement sendEmail with logging**

Replace sendEmail function:

```typescript
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  // Create log entry first
  const emailLog = await prisma.emailLog.create({
    data: {
      to: options.to,
      subject: options.subject,
      htmlBody: options.html,
      type: options.type,
      userId: options.userId,
      status: 'PENDING',
      attempts: 0,
    },
  });

  // Attempt send with retry
  const result = await attemptSendWithRetry(emailLog.id, options);

  return {
    success: result.success,
    emailLogId: emailLog.id,
    error: result.error,
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/email.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "feat(email): add logging to sendEmail"
```

---

## Task 3: Email Service - Retry Logic

**Files:**
- Modify: `src/lib/email.ts`
- Modify: `src/lib/email.test.ts`

**Step 1: Write test for retry behavior**

Add to `src/lib/email.test.ts`:

```typescript
describe('retry logic', () => {
  it('retries up to 3 times on failure', async () => {
    const { Resend } = await import('resend');
    const mockSend = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ id: 'resend_123' });

    vi.mocked(Resend).mockImplementation(() => ({
      emails: { send: mockSend },
    } as any));

    vi.mocked(prisma.emailLog.create).mockResolvedValue({
      id: 'log_1',
      // ... other fields
    } as any);

    const { sendEmail } = await import('./email');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      type: 'test',
    });

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('marks as FAILED after 3 failed attempts', async () => {
    const { Resend } = await import('resend');
    vi.mocked(Resend).mockImplementation(() => ({
      emails: {
        send: vi.fn().mockRejectedValue(new Error('Always fails')),
      },
    } as any));

    vi.mocked(prisma.emailLog.create).mockResolvedValue({
      id: 'log_1',
    } as any);

    const { sendEmail } = await import('./email');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      type: 'test',
    });

    expect(result.success).toBe(false);
    expect(prisma.emailLog.update).toHaveBeenLastCalledWith({
      where: { id: 'log_1' },
      data: { status: 'FAILED' },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/email.test.ts`
Expected: FAIL (retry logic not implemented)

**Step 3: Implement retry logic**

Add to `src/lib/email.ts`:

```typescript
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptSendWithRetry(
  emailLogId: string,
  options: SendEmailOptions
): Promise<{ success: boolean; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { attempts: attempt },
      });

      const result = await sendViaResend(options);

      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerId: result.id,
          lastError: null,
        },
      });

      return { success: true };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';

      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { lastError },
      });

      if (attempt < MAX_ATTEMPTS) {
        await sleep(BACKOFF_MS[attempt - 1]);
      }
    }
  }

  await prisma.emailLog.update({
    where: { id: emailLogId },
    data: { status: 'FAILED' },
  });

  return { success: false, error: lastError };
}

async function sendViaResend(options: SendEmailOptions): Promise<{ id: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email Dev Mode]', options.to, options.subject);
    return { id: `dev_${Date.now()}` };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { id: data?.id || 'unknown' };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/email.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "feat(email): add retry logic with exponential backoff"
```

---

## Task 4: Email Service - Resend Function

**Files:**
- Modify: `src/lib/email.ts`
- Modify: `src/lib/email.test.ts`

**Step 1: Write test for resendEmail**

Add to `src/lib/email.test.ts`:

```typescript
describe('resendEmail', () => {
  it('resets status and attempts before resending', async () => {
    vi.mocked(prisma.emailLog.findUnique).mockResolvedValue({
      id: 'log_1',
      to: 'test@example.com',
      subject: 'Test',
      htmlBody: '<p>Test</p>',
      type: 'test',
      userId: null,
      status: 'FAILED',
      attempts: 3,
    } as any);

    const { resendEmail } = await import('./email');
    await resendEmail('log_1');

    expect(prisma.emailLog.update).toHaveBeenCalledWith({
      where: { id: 'log_1' },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
      },
    });
  });

  it('throws if email log not found', async () => {
    vi.mocked(prisma.emailLog.findUnique).mockResolvedValue(null);

    const { resendEmail } = await import('./email');
    await expect(resendEmail('nonexistent')).rejects.toThrow('Email log not found');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/email.test.ts`
Expected: FAIL (resendEmail not implemented)

**Step 3: Implement resendEmail**

Add to `src/lib/email.ts`:

```typescript
export async function resendEmail(emailLogId: string): Promise<SendEmailResult> {
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
  });

  if (!emailLog) {
    throw new Error('Email log not found');
  }

  await prisma.emailLog.update({
    where: { id: emailLogId },
    data: {
      status: 'PENDING',
      attempts: 0,
      lastError: null,
    },
  });

  const result = await attemptSendWithRetry(emailLogId, {
    to: emailLog.to,
    subject: emailLog.subject,
    html: emailLog.htmlBody,
    type: emailLog.type,
    userId: emailLog.userId ?? undefined,
  });

  return {
    success: result.success,
    emailLogId,
    error: result.error,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/email.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "feat(email): add resendEmail function"
```

---

## Task 5: Update Existing Email Calls

**Files:**
- Modify: All files that call sendEmail

**Step 1: Find all sendEmail calls**

Run: `grep -r "sendEmail(" src/ --include="*.ts" --include="*.tsx" -l`

**Step 2: Update each call to include type parameter**

For each file found, update sendEmail calls to include `type`:

```typescript
// Before
await sendEmail({
  to: user.email,
  subject: 'Verify your email',
  html: verificationHtml,
});

// After
await sendEmail({
  to: user.email,
  subject: 'Verify your email',
  html: verificationHtml,
  type: 'verification',
  userId: user.id,
});
```

Common types:
- `verification` - Email verification
- `password_reset` - Password reset
- `invite` - Organization invite
- `welcome` - Welcome email

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/
git commit -m "refactor(email): add type parameter to all sendEmail calls"
```

---

## Task 6: Admin API - List Emails

**Files:**
- Create: `src/app/api/admin/emails/route.ts`

**Step 1: Create list endpoint**

Create `src/app/api/admin/emails/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api-utils';
import { EmailStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const status = searchParams.get('status') as EmailStatus | null;
  const type = searchParams.get('type');
  const search = searchParams.get('search');

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { to: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [emails, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        to: true,
        subject: true,
        type: true,
        status: true,
        attempts: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    prisma.emailLog.count({ where }),
  ]);

  return NextResponse.json({
    emails,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
```

**Step 2: Verify endpoint works**

Run: `npm run dev`
Test: `curl http://localhost:3000/api/admin/emails` (with auth)

**Step 3: Commit**

```bash
git add src/app/api/admin/emails/route.ts
git commit -m "feat(api): add GET /api/admin/emails endpoint"
```

---

## Task 7: Admin API - Get Email Details

**Files:**
- Create: `src/app/api/admin/emails/[id]/route.ts`

**Step 1: Create detail endpoint**

Create `src/app/api/admin/emails/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const email = await prisma.emailLog.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  return NextResponse.json(email);
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/emails/[id]/route.ts
git commit -m "feat(api): add GET /api/admin/emails/[id] endpoint"
```

---

## Task 8: Admin API - Resend Email

**Files:**
- Create: `src/app/api/admin/emails/[id]/resend/route.ts`

**Step 1: Create resend endpoint**

Create `src/app/api/admin/emails/[id]/resend/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-utils';
import { resendEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    const result = await resendEmail(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Resend failed' },
      { status: 400 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/emails/[id]/resend/route.ts
git commit -m "feat(api): add POST /api/admin/emails/[id]/resend endpoint"
```

---

## Task 9: Admin UI - Email Log Table Component

**Files:**
- Create: `src/components/admin/email-log-table.tsx`

**Step 1: Create table component**

Create `src/components/admin/email-log-table.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { EmailStatus } from '@prisma/client';

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: EmailStatus;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
}

interface EmailLogTableProps {
  emails: EmailLog[];
  onView: (id: string) => void;
  onResend: (id: string) => void;
}

const statusColors: Record<EmailStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SENT: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  BOUNCED: 'bg-red-100 text-red-800',
};

export function EmailLogTable({ emails, onView, onResend }: EmailLogTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempts</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {emails.map((email) => (
            <tr key={email.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm">{email.to}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm max-w-xs truncate">{email.subject}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs rounded-full bg-gray-100">{email.type}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs rounded-full ${statusColors[email.status]}`}>
                  {email.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">{email.attempts}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {email.sentAt ? new Date(email.sentAt).toLocaleString() : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                <button
                  onClick={() => onView(email.id)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  View
                </button>
                {email.status === 'FAILED' && (
                  <button
                    onClick={() => onResend(email.id)}
                    className="text-green-600 hover:text-green-800"
                  >
                    Resend
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/admin/email-log-table.tsx
git commit -m "feat(ui): add EmailLogTable component"
```

---

## Task 10: Admin UI - Email Preview Modal

**Files:**
- Create: `src/components/admin/email-preview-modal.tsx`

**Step 1: Create modal component**

Create `src/components/admin/email-preview-modal.tsx`:

```typescript
'use client';

import { EmailStatus } from '@prisma/client';

interface EmailDetail {
  id: string;
  to: string;
  subject: string;
  htmlBody: string;
  type: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

interface EmailPreviewModalProps {
  email: EmailDetail | null;
  onClose: () => void;
  onResend: (id: string) => void;
}

export function EmailPreviewModal({ email, onClose, onResend }: EmailPreviewModalProps) {
  if (!email) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Email Preview</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">To:</span> {email.to}
            </div>
            <div>
              <span className="font-medium">Type:</span> {email.type}
            </div>
            <div>
              <span className="font-medium">Status:</span> {email.status}
            </div>
            <div>
              <span className="font-medium">Attempts:</span> {email.attempts}
            </div>
            {email.lastError && (
              <div className="col-span-2">
                <span className="font-medium text-red-600">Error:</span> {email.lastError}
              </div>
            )}
          </div>

          <div>
            <span className="font-medium">Subject:</span>
            <div className="mt-1 p-2 bg-gray-50 rounded">{email.subject}</div>
          </div>

          <div>
            <span className="font-medium">Body:</span>
            <iframe
              srcDoc={email.htmlBody}
              className="mt-1 w-full h-64 border rounded"
              sandbox="allow-same-origin"
              title="Email preview"
            />
          </div>
        </div>

        <div className="p-4 border-t flex justify-end space-x-2">
          {email.status === 'FAILED' && (
            <button
              onClick={() => onResend(email.id)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Resend
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/admin/email-preview-modal.tsx
git commit -m "feat(ui): add EmailPreviewModal component"
```

---

## Task 11: Admin UI - Emails Page

**Files:**
- Create: `src/app/admin/emails/page.tsx`

**Step 1: Create admin emails page**

Create `src/app/admin/emails/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { EmailLogTable } from '@/components/admin/email-log-table';
import { EmailPreviewModal } from '@/components/admin/email-preview-modal';
import { EmailStatus } from '@prisma/client';

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: EmailStatus;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
}

interface EmailDetail extends EmailLog {
  htmlBody: string;
  lastError: string | null;
  user?: { id: string; email: string; name: string | null } | null;
}

export default function AdminEmailsPage() {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      ...(statusFilter && { status: statusFilter }),
      ...(typeFilter && { type: typeFilter }),
      ...(search && { search }),
    });

    const res = await fetch(`/api/admin/emails?${params}`);
    const data = await res.json();
    setEmails(data.emails);
    setTotalPages(data.pagination.totalPages);
    setLoading(false);
  }, [page, statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const handleView = async (id: string) => {
    const res = await fetch(`/api/admin/emails/${id}`);
    const email = await res.json();
    setSelectedEmail(email);
  };

  const handleResend = async (id: string) => {
    const res = await fetch(`/api/admin/emails/${id}/resend`, { method: 'POST' });
    if (res.ok) {
      fetchEmails();
      setSelectedEmail(null);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Email Logs</h1>

      <div className="mb-4 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="BOUNCED">Bounced</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Types</option>
          <option value="verification">Verification</option>
          <option value="password_reset">Password Reset</option>
          <option value="invite">Invite</option>
        </select>

        <input
          type="text"
          placeholder="Search by email or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <EmailLogTable emails={emails} onView={handleView} onResend={handleResend} />

          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      <EmailPreviewModal
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
        onResend={handleResend}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/admin/emails/page.tsx
git commit -m "feat(ui): add admin emails page"
```

---

## Task 12: Add Navigation Link

**Files:**
- Modify: Admin sidebar/navigation component

**Step 1: Find admin navigation**

Run: `grep -r "admin" src/components --include="*.tsx" -l | head -5`

**Step 2: Add Emails link to admin navigation**

Add link to `/admin/emails` in the admin navigation component, near other admin links.

**Step 3: Commit**

```bash
git add src/components/
git commit -m "feat(ui): add Emails link to admin navigation"
```

---

## Task 13: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

---

## Success Criteria Verification

- [ ] EmailLog model exists with all indexes
- [ ] sendEmail creates log entry before sending
- [ ] Retry logic works (3 attempts, exponential backoff)
- [ ] Admin can list emails with filters at /admin/emails
- [ ] Admin can view email details with HTML preview
- [ ] Admin can resend failed emails
- [ ] All tests pass
- [ ] Build succeeds

---

Generated with [Claude Code](https://claude.ai/code)
