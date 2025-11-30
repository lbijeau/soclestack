# User Impersonation (Switch User) Design

**Date:** 2025-11-30
**Status:** Approved

## Overview

Admins can temporarily assume the identity of another user for debugging and support purposes. The original admin identity is preserved in the session, with a visible banner and automatic timeout.

**Key constraints:**
- Only ADMIN role can impersonate
- Cannot impersonate other ADMINs
- Security actions blocked during impersonation (password, 2FA, account deletion)
- 1-hour maximum duration with auto-expiry
- Full audit trail of all impersonation events

---

## Session Data Changes

The `SessionData` interface will be extended:

```typescript
export interface SessionData {
  userId: string
  email: string
  role: Role
  isLoggedIn: boolean
  // Impersonation fields (only set when impersonating)
  impersonating?: {
    originalUserId: string
    originalEmail: string
    originalRole: Role
    startedAt: number  // Unix timestamp for timeout check
  }
}
```

When impersonating:
- `userId`, `email`, `role` reflect the **target user**
- `impersonating` object stores the **original admin**
- Check `impersonating.startedAt` against 1-hour limit on each request

Helper functions:
- `isImpersonating(session)` - returns boolean
- `hasImpersonationExpired(session)` - checks if past 1-hour limit
- `getOriginalAdmin(session)` - returns original admin info or null

---

## API Endpoints

Two new endpoints under `/api/admin/`:

### POST `/api/admin/impersonate`

- Body: `{ userId: string }`
- Validates: caller is ADMIN, target exists, target is not ADMIN
- Stores original admin in `impersonating` object
- Updates session to target user's identity
- Logs `ADMIN_IMPERSONATION_START` audit event
- Returns: `{ success: true, user: { id, email, role } }`

### POST `/api/admin/exit-impersonation`

- No body required
- Validates: session has `impersonating` set
- Restores original admin identity from `impersonating`
- Clears `impersonating` object
- Logs `ADMIN_IMPERSONATION_END` audit event
- Returns: `{ success: true }`

### Automatic Expiry Handling

- Middleware or API routes check `hasImpersonationExpired()`
- If expired, auto-restore admin identity and log `ADMIN_IMPERSONATION_EXPIRED`

---

## Blocked Actions During Impersonation

These API routes will reject requests when `isImpersonating()` is true:

- `POST /api/auth/2fa/setup` - Cannot enable 2FA
- `POST /api/auth/2fa/disable` - Cannot disable 2FA
- `POST /api/auth/2fa/verify` - Cannot complete 2FA setup
- `POST /api/users/profile` (password field) - Cannot change password
- `DELETE /api/users/[id]` - Cannot delete account

Each blocked endpoint returns:

```json
{
  "error": {
    "type": "FORBIDDEN",
    "message": "This action is not allowed while impersonating a user"
  }
}
```

Implementation approach:
- Create `assertNotImpersonating(session)` helper that throws if impersonating
- Add this check at the start of each protected route

---

## UI Components

### Impersonation Banner

`src/components/admin/impersonation-banner.tsx`

- Fixed position at top of viewport
- Orange/amber background for visibility
- Shows: "You are impersonating **{user email}** - Time remaining: 45m"
- "Exit Impersonation" button on the right
- Pushes page content down (not overlapping)

### Integration

- Add banner to root layout, conditionally rendered when `impersonating` is set
- Banner fetches session state via `/api/auth/session` or passed as prop from server component

### Admin User List Enhancement

- Add "Impersonate" button next to each non-admin user in the admin user management UI
- Button triggers the impersonation flow

---

## Audit Events

New audit actions to add to `src/lib/audit.ts`:

```typescript
| 'ADMIN_IMPERSONATION_START'   // Admin began impersonating
| 'ADMIN_IMPERSONATION_END'     // Admin exited impersonation
| 'ADMIN_IMPERSONATION_EXPIRED' // Impersonation auto-expired after 1 hour
```

Metadata logged for each event:
- `adminUserId` - The original admin
- `targetUserId` - The user being impersonated
- `targetEmail` - For readability in logs
- `duration` - How long the impersonation lasted (for END/EXPIRED)

---

## File Structure

### New Files

```
src/
├── lib/auth/
│   └── impersonation.ts           # Core logic: start, exit, helpers
├── app/api/admin/
│   ├── impersonate/route.ts       # POST - start impersonation
│   └── exit-impersonation/route.ts # POST - end impersonation
└── components/admin/
    └── impersonation-banner.tsx   # Sticky top banner
```

### Files to Modify

- `src/types/auth.ts` - Update SessionData interface
- `src/lib/config/security.ts` - Add impersonation timeout config
- `src/lib/audit.ts` - Add new audit events
- `src/app/api/auth/2fa/*` routes - Add impersonation check
- `src/app/layout.tsx` - Include impersonation banner
- Admin user list component - Add impersonate button

---

## Configuration

Add to `src/lib/config/security.ts`:

```typescript
impersonation: {
  timeoutMinutes: 60,  // Auto-expire after 1 hour
}
```
