# Email Notifications Design

**Date:** 2025-11-30
**Status:** Ready for implementation

## Overview

Send security-related email notifications to users for important account events.

- **Email Provider:** Resend (simple API, generous free tier)
- **Development Mode:** Console logging only (no real emails in dev)
- **New Dependency:** `resend` npm package

## Notifications

1. **Login from new device/location** - IP + user-agent combo not seen before
2. **Account locked** - After 5 failed login attempts
3. **Password changed** - After successful password reset
4. **2FA enabled** - After 2FA setup verified
5. **2FA disabled** - After 2FA disabled

## Email Service

**File:** `src/lib/email.ts`

```typescript
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<boolean>
```

**Behavior:**
- Development (`NODE_ENV !== 'production'`): Log to console, return true
- Production: Use Resend API with `RESEND_API_KEY`
- Returns `true`/`false` (never throws - emails shouldn't break auth flows)

**Convenience functions:**
- `sendNewDeviceAlert(to, deviceInfo, loginTime)`
- `sendAccountLockedNotification(to, unlockTime)`
- `sendPasswordChangedNotification(to, changedAt)`
- `sendTwoFactorEnabledNotification(to)`
- `sendTwoFactorDisabledNotification(to)`

## New Device Detection

**Logic** (in login route, after successful auth):

1. Get current IP + user-agent from request
2. Check RememberMeToken table for matching `userId + ipAddress + userAgent`
3. If no match, check AuditLog for `AUTH_LOGIN_SUCCESS` with same IP + user-agent in last 30 days
4. If neither match → new device → send notification

**Device info in email:**
- Browser (parsed from user-agent)
- Operating system (parsed from user-agent)
- IP address
- Login time

## Email Templates

**File:** `src/lib/email/templates.ts`

Simple HTML wrapper with inline styles for email client compatibility.

**Templates:**

| Notification | Subject |
|--------------|---------|
| New device | "New login to your SocleStack account" |
| Account locked | "Your SocleStack account has been locked" |
| Password changed | "Your SocleStack password was changed" |
| 2FA enabled | "Two-factor authentication enabled" |
| 2FA disabled | "Two-factor authentication disabled" |

Each includes appropriate call-to-action for security concerns.

## Integration Points

| Event | File | When |
|-------|------|------|
| New device | `src/app/api/auth/login/route.ts` | After successful login, if device unknown |
| Account locked | `src/lib/auth/lockout.ts` | When `lockAccount()` is called |
| Password changed | `src/app/api/auth/reset-password/route.ts` | After successful reset |
| 2FA enabled | `src/app/api/auth/2fa/verify/route.ts` | After setup verified |
| 2FA disabled | `src/app/api/auth/2fa/disable/route.ts` | After disabled |

**Pattern:** Non-blocking (fire-and-forget)
```typescript
sendNewDeviceAlert(email, deviceInfo, time).catch(console.error);
```

## File Structure

**Create:**
```
src/lib/
├── email.ts                    # Email service
├── email/
│   └── templates.ts            # HTML templates
└── utils/
    └── user-agent.ts           # Shared parseUserAgent
```

**Modify:**
```
src/app/api/auth/login/route.ts
src/lib/auth/lockout.ts
src/app/api/auth/reset-password/route.ts
src/app/api/auth/2fa/verify/route.ts
src/app/api/auth/2fa/disable/route.ts
src/components/profile/sessions-list.tsx  # Import from shared util
```

## Environment Variables

```
RESEND_API_KEY=           # Required in production
EMAIL_FROM=noreply@soclestack.com
```
