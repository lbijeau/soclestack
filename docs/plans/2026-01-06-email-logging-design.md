# Email Logging & Admin UI Design

**Date:** 2026-01-06
**Status:** Draft
**Author:** Architecture Brainstorm

## Executive Summary

Add email logging infrastructure and admin visibility. Every email sent through SocleStack is logged with status tracking, retry support, and an admin UI for debugging and operations.

**Core principle:** Log first, send second. Every email gets a database record before delivery attempt.

## Problem Statement

Emails currently fire into the void with no visibility:
- No way to verify if emails were sent
- No debugging when users report "didn't receive email"
- No retry mechanism for transient failures
- No audit trail for compliance

**Scope:**
- EmailLog database table for all sent emails
- Status tracking (PENDING → SENT → DELIVERED/FAILED/BOUNCED)
- Simple retry logic (3 attempts, exponential backoff)
- Admin UI for viewing logs, filtering, and manual resend

**Out of scope (for now):**
- Transport abstraction (multiple providers)
- Async/queue system
- Notification preferences
- Webhook handling for delivery status

## Database Schema

### EmailLog Model

```prisma
model EmailLog {
  id          String      @id @default(cuid())
  to          String
  userId      String?
  user        User?       @relation(fields: [userId], references: [id])
  type        String      // "verification", "password_reset", "invite", etc.
  subject     String
  htmlBody    String      @db.Text
  status      EmailStatus @default(PENDING)
  attempts    Int         @default(0)
  lastError   String?
  sentAt      DateTime?
  provider    String      @default("resend")
  providerId  String?     // Provider's message ID
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([to])
  @@index([userId])
  @@index([status])
  @@index([type])
  @@index([createdAt])
}

enum EmailStatus {
  PENDING     // Created, not yet sent
  SENT        // Accepted by provider
  DELIVERED   // Confirmed delivered (future: webhook)
  FAILED      // All retries exhausted
  BOUNCED     // Provider reported bounce (future: webhook)
}
```

### User Relation

Add to User model:

```prisma
model User {
  // ... existing fields
  emailLogs   EmailLog[]
}
```

## Email Service Changes

### Updated Interface

```typescript
interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  type: string;        // NEW: email type for logging
  userId?: string;     // NEW: optional user link
}

interface SendEmailResult {
  success: boolean;
  emailLogId: string;
  error?: string;
}
```

### Send Flow with Logging

```typescript
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  // 1. Create log entry first (PENDING)
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

  // 2. Attempt send with retry
  const result = await attemptSendWithRetry(emailLog.id, options);

  return {
    success: result.success,
    emailLogId: emailLog.id,
    error: result.error,
  };
}
```

### Retry Logic

```typescript
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000]; // Exponential: 1s, 2s, 4s

async function attemptSendWithRetry(
  emailLogId: string,
  options: SendEmailOptions
): Promise<{ success: boolean; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Update attempt count
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { attempts: attempt },
      });

      // Send via provider
      const result = await sendViaResend(options);

      // Success - update log
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

      // Update log with error
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { lastError },
      });

      // Wait before retry (except on last attempt)
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BACKOFF_MS[attempt - 1]);
      }
    }
  }

  // All attempts failed
  await prisma.emailLog.update({
    where: { id: emailLogId },
    data: { status: 'FAILED' },
  });

  return { success: false, error: lastError };
}
```

### Resend Function

```typescript
export async function resendEmail(emailLogId: string): Promise<SendEmailResult> {
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
  });

  if (!emailLog) {
    throw new Error('Email log not found');
  }

  // Reset status and attempt send
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

## Admin UI

### Route: `/admin/emails`

Email log listing with filters and actions.

### Page Features

**Filters:**
- Status dropdown (All, Pending, Sent, Failed, Bounced)
- Type dropdown (All, Verification, Password Reset, Invite, etc.)
- Date range picker
- Search by recipient email

**Table Columns:**
- To (email address)
- Subject
- Type (badge)
- Status (color-coded badge)
- Attempts
- Sent At
- Actions

**Actions:**
- View (opens preview modal)
- Resend (for failed emails only)

### Email Preview Modal

- Subject line
- Recipient
- Status with timestamp
- Error message (if failed)
- HTML preview in sandboxed iframe
- Resend button (if failed)

### API Endpoints

```
GET  /api/admin/emails         - List emails with pagination/filters
GET  /api/admin/emails/[id]    - Get single email details
POST /api/admin/emails/[id]/resend - Resend a failed email
```

### List Endpoint Response

```typescript
interface EmailListResponse {
  emails: Array<{
    id: string;
    to: string;
    subject: string;
    type: string;
    status: EmailStatus;
    attempts: number;
    sentAt: string | null;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

## File Structure

```
prisma/
└── schema.prisma              # MODIFY: Add EmailLog model

src/
├── lib/
│   └── email.ts               # MODIFY: Add logging, retry, resend
├── app/
│   ├── admin/
│   │   └── emails/
│   │       └── page.tsx       # NEW: Email logs admin page
│   └── api/
│       └── admin/
│           └── emails/
│               ├── route.ts           # NEW: List emails
│               └── [id]/
│                   ├── route.ts       # NEW: Get email details
│                   └── resend/
│                       └── route.ts   # NEW: Resend email
└── components/
    └── admin/
        ├── email-log-table.tsx        # NEW: Table component
        └── email-preview-modal.tsx    # NEW: Preview modal
```

## Success Criteria

- [ ] EmailLog model added to schema with all indexes
- [ ] Every email creates a log entry before send attempt
- [ ] Failed sends retry 3 times with exponential backoff
- [ ] Admin can view all email logs with filters
- [ ] Admin can preview email HTML content
- [ ] Admin can resend failed emails
- [ ] Status tracking works (PENDING → SENT or FAILED)

## Future Enhancements (Not MVP)

- Webhook handling for DELIVERED/BOUNCED status
- Transport abstraction (multiple providers)
- Async queue for high-volume sending
- Email templates management
- Notification preferences per user
- Bulk resend capability

---

Generated with [Claude Code](https://claude.ai/code)
