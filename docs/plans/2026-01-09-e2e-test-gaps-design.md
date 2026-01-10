# E2E Test Coverage Gaps

## Overview

Analysis of current end-to-end test coverage reveals significant gaps across multiple feature areas. This document catalogs missing tests and prioritizes implementation.

## Current Coverage

The following areas have e2e test coverage:

| Area | Test File | Coverage Level |
|------|-----------|----------------|
| Authentication | `auth/authentication.spec.ts` | Comprehensive |
| Login | `auth/login.spec.ts` | Comprehensive |
| Registration | `auth/registration.spec.ts` | Comprehensive |
| Role-Based Access | `authorization/role-based-access.spec.ts` | Comprehensive |
| CSRF | `security/csrf-*.spec.ts` | Comprehensive |
| CSP Headers | `security/csp-headers.spec.ts` | Good |
| Accessibility | `accessibility/accessibility.spec.ts` | Good |
| Performance | `performance/performance.spec.ts` | Good |
| Profile Management | `user-management/profile-management.spec.ts` | Basic |
| Form Validation | `validation/form-validation.spec.ts` | Good |

## Identified Gaps

### Priority 1: High (Security-Critical)

#### 1.1 Two-Factor Authentication (2FA)

**Affected endpoints:**
- `POST /api/auth/2fa/setup` - Generate TOTP secret
- `POST /api/auth/2fa/verify` - Verify and enable 2FA
- `POST /api/auth/2fa/validate` - Validate code on login
- `POST /api/auth/2fa/disable` - Disable 2FA

**Affected pages:**
- `/auth/two-factor` - 2FA challenge during login

**Required tests:**
- Setup flow: generate secret, display QR code, verify code
- Login with 2FA enabled
- Invalid code rejection
- Rate limiting on 2FA attempts
- Disable flow with password confirmation
- Recovery code usage

#### 1.2 Organizations (Multi-Tenant Core)

**Affected endpoints:**
- `POST /api/organizations` - Create organization
- `GET/PUT /api/organizations/current` - Current org details
- `GET/POST /api/organizations/current/members` - Member management
- `PUT/DELETE /api/organizations/current/members/[id]` - Member actions
- `GET/POST /api/organizations/current/invites` - Invite management
- `GET /api/invites/[token]` - View invite
- `POST /api/invites/[token]/accept` - Accept invite

**Affected pages:**
- `/organization` - Organization dashboard
- `/organization/members` - Member list
- `/organization/invites` - Pending invites
- `/invite/[token]` - Accept invite page

**Required tests:**
- Organization CRUD lifecycle
- Member invite flow (send, view, accept, reject)
- Member role changes (OWNER/ADMIN/MEMBER)
- Member removal
- Organization deletion with members
- Cross-org isolation verification

### Priority 2: Medium (Power-User/Developer Features)

#### 2.1 Admin Panel Functionality

Current tests only verify access control, not functionality.

**Affected areas:**

**Audit Logs (`/admin/audit-logs`):**
- View audit log entries
- Filter by date, user, action type
- Export logs
- Pagination

**Role Management (`/admin/roles/*`):**
- Create custom role
- Edit role permissions
- Delete role (with user reassignment)
- Role hierarchy enforcement

**Organization Admin (`/admin/organizations/*`):**
- View all organizations
- View organization details
- Manage organization members as platform admin

**User Bulk Operations:**
- Bulk role assignment
- Bulk deactivation
- Bulk deletion

**Impersonation (`/api/admin/impersonate`):**
- Start impersonation session
- Impersonation indicator visible
- Exit impersonation
- Audit log entries for impersonation

**Email Logs (`/admin/emails`):**
- View sent emails
- View email status
- Resend failed emails
- Email delivery webhook handling

#### 2.2 Session & Device Management

**Affected pages:**
- `/profile/sessions` - Active sessions
- `/profile/devices` - Trusted devices
- `/profile/login-history` - Login attempts
- `/profile/activity` - Activity timeline

**Required tests:**
- View active sessions
- Terminate specific session
- Terminate all other sessions
- View device list
- Revoke device trust
- Login history accuracy
- Activity log entries

#### 2.3 API Keys

**Affected endpoints:**
- `GET /api/keys` - List API keys
- `POST /api/keys` - Create API key
- `DELETE /api/keys/[id]` - Revoke API key

**Required tests:**
- Create API key (display secret once)
- List API keys (masked secrets)
- Use API key for authentication
- Revoke API key
- Rate limiting per key

### Priority 3: Low (Edge Cases)

#### 3.1 Account Unlock

**Affected endpoints:**
- `POST /api/auth/request-unlock` - Request unlock email
- `POST /api/auth/verify-unlock` - Verify unlock token

**Affected pages:**
- `/request-unlock` - Request form
- `/unlock-account` - Verify token page

**Required tests:**
- Request unlock after lockout
- Verify unlock token
- Invalid/expired token handling

#### 3.2 Email Verification Flow

Partially tested but missing actual verification.

**Required tests:**
- Click verify link from email
- Expired token handling
- Resend verification email
- Already verified handling

#### 3.3 User Data Management

**Affected endpoints:**
- `GET /api/users/export` - Export user data
- `DELETE /api/users/delete-account` - Delete account

**Required tests:**
- Export data (GDPR compliance)
- Export format validation
- Account deletion with confirmation
- Account deletion cascade effects

#### 3.4 Branding/Theming

**Required tests:**
- Custom logo renders correctly
- Custom primary color applies
- Favicon updates
- Brand name in title/emails

## Test File Structure

Proposed new test files:

```
tests/e2e/
├── auth/
│   ├── two-factor.spec.ts          # NEW
│   └── account-unlock.spec.ts      # NEW
├── organizations/
│   ├── organization-crud.spec.ts   # NEW
│   ├── member-management.spec.ts   # NEW
│   └── invites.spec.ts             # NEW
├── admin/
│   ├── audit-logs.spec.ts          # NEW
│   ├── role-management.spec.ts     # NEW
│   ├── organization-admin.spec.ts  # NEW
│   ├── user-bulk-ops.spec.ts       # NEW
│   ├── impersonation.spec.ts       # NEW
│   └── email-logs.spec.ts          # NEW
├── user-management/
│   ├── sessions.spec.ts            # NEW
│   ├── devices.spec.ts             # NEW
│   ├── login-history.spec.ts       # NEW
│   └── data-export.spec.ts         # NEW
├── api/
│   └── api-keys.spec.ts            # NEW
└── theming/
    └── branding.spec.ts            # NEW
```

## Page Object Additions

New page objects needed:

```
tests/pages/
├── TwoFactorPage.ts
├── OrganizationPage.ts
├── InvitePage.ts
├── AdminAuditLogsPage.ts
├── AdminRolesPage.ts
├── SessionsPage.ts
├── DevicesPage.ts
└── ApiKeysPage.ts
```

## Implementation Order

1. **2FA** - Security-critical, complex user flow
2. **Organizations** - Core multi-tenant functionality
3. **Admin functionality** - Platform management
4. **Session/device management** - Security visibility
5. **API keys** - Developer experience
6. **Account unlock** - Edge case recovery
7. **Branding** - Visual verification

## Estimated Effort

| Area | New Tests | Complexity |
|------|-----------|------------|
| 2FA | ~8 tests | High |
| Organizations | ~12 tests | High |
| Admin Panel | ~20 tests | Medium |
| Session/Device | ~10 tests | Low |
| API Keys | ~6 tests | Low |
| Account Unlock | ~4 tests | Low |
| Branding | ~4 tests | Low |

**Total: ~64 new e2e tests**
