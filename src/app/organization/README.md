# Organization Pages

> Multi-tenant organization management with roles, members, and invitations.

## Purpose

This directory contains pages for organization management, enabling multi-tenancy with role-based access control. Users can create organizations, invite members, manage roles, and configure organization settings.

## Contents

| File               | Description                                        |
| ------------------ | -------------------------------------------------- |
| `page.tsx`         | Main organization settings page                    |
| `members/page.tsx` | Member list with role management                   |
| `invites/page.tsx` | Invitation management (send, view pending, cancel) |

## Role Hierarchy

Organizations use a three-tier role system with hierarchical permissions:

| Role     | Level | Can Invite | Can Manage Members | Can Delete Org |
| -------- | ----- | ---------- | ------------------ | -------------- |
| `OWNER`  | 2     | Yes        | All except self    | Yes            |
| `ADMIN`  | 1     | Yes        | Members only       | No             |
| `MEMBER` | 0     | No         | No                 | No             |

### Permission Rules

1. **Self-management disabled**: Users cannot change their own role or remove themselves
2. **Hierarchical restriction**: Cannot manage users with equal or higher role
3. **Owner protection**: Only one owner per organization; cannot be demoted
4. **Admin limitations**: Admins can only manage Members, not other Admins

## Page Architecture

### Organization Settings (`page.tsx`)

The main settings page with quick links and organization details.

**Features:**

- Quick links to Members and Invites (role-gated)
- Display current user's role
- Edit organization name (Owner/Admin only)
- Delete organization (Owner only)

**API Integration:**

- `GET /api/organizations/current` - Fetch organization details
- `PATCH /api/organizations/current` - Update organization name
- `DELETE /api/organizations/current` - Delete organization

### Members (`members/page.tsx`)

List and manage organization members.

**Features:**

- View all members with roles
- Change member roles (Owner can promote to Admin)
- Remove members from organization
- Role badges with color coding

**API Integration:**

- `GET /api/organizations/current/members` - List members
- `PATCH /api/organizations/current/members/:id` - Update member role
- `DELETE /api/organizations/current/members/:id` - Remove member

### Invites (`invites/page.tsx`)

Send and manage pending invitations.

**Features:**

- Send invites by email with role selection
- View pending invitations with expiry dates
- Cancel pending invites
- Expired invite indication

**API Integration:**

- `GET /api/organizations/current/invites` - List pending invites
- `POST /api/organizations/current/invites` - Create new invite
- `DELETE /api/organizations/current/invites/:id` - Cancel invite

## Invitation Flow

```
┌─────────────┐     ┌───────────────┐     ┌─────────────┐
│ Admin sends │────▶│ Email with    │────▶│ User clicks │
│ invite      │     │ invite link   │     │ accept link │
└─────────────┘     └───────────────┘     └─────────────┘
                                                 │
                    ┌───────────────┐            ▼
                    │ User added to │◀────┬─────────────┐
                    │ organization  │     │ Accept page │
                    └───────────────┘     └─────────────┘
```

**Invite Properties:**

- **Token**: Secure 64-character hex string
- **Expiry**: 7 days from creation (configurable via `INVITE_EXPIRY_DAYS`)
- **Role**: Assigned role when invite is accepted (ADMIN or MEMBER)

## Dependencies

### Internal Dependencies

- `@/components/navigation/navbar` - Navigation bar
- `@/components/ui/*` - Card, Button, Input, Badge components

### External Dependencies

- `next/navigation` - Router for redirects
- `lucide-react` - Icons

### Library Dependencies

- `@/lib/organization` - Organization utilities (slug generation, role checks)

## API Endpoints

### Organization Management

| Method   | Endpoint                     | Description              |
| -------- | ---------------------------- | ------------------------ |
| `GET`    | `/api/organizations/current` | Get current organization |
| `PATCH`  | `/api/organizations/current` | Update organization      |
| `DELETE` | `/api/organizations/current` | Delete organization      |

### Member Management

| Method   | Endpoint                                 | Description        |
| -------- | ---------------------------------------- | ------------------ |
| `GET`    | `/api/organizations/current/members`     | List all members   |
| `PATCH`  | `/api/organizations/current/members/:id` | Update member role |
| `DELETE` | `/api/organizations/current/members/:id` | Remove member      |

### Invite Management

| Method   | Endpoint                                 | Description          |
| -------- | ---------------------------------------- | -------------------- |
| `GET`    | `/api/organizations/current/invites`     | List pending invites |
| `POST`   | `/api/organizations/current/invites`     | Send new invite      |
| `DELETE` | `/api/organizations/current/invites/:id` | Cancel invite        |

### Invite Acceptance

| Method | Endpoint                     | Description        |
| ------ | ---------------------------- | ------------------ |
| `GET`  | `/api/invites/:token`        | Get invite details |
| `POST` | `/api/invites/:token/accept` | Accept invitation  |

## States

All pages handle these states consistently:

### Loading State

```tsx
<div className="flex items-center justify-center py-12">
  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
</div>
```

### Error State

```tsx
<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
  {error}
</div>
```

### Success State

```tsx
<div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
  {success}
</div>
```

## Role Badge Styling

| Role     | Background      | Text Color        |
| -------- | --------------- | ----------------- |
| `OWNER`  | `bg-purple-100` | `text-purple-800` |
| `ADMIN`  | `bg-blue-100`   | `text-blue-800`   |
| `MEMBER` | `bg-gray-100`   | `text-gray-800`   |

## Security Considerations

- **Role-gated access**: Invites page requires ADMIN or OWNER role
- **CSRF protection**: All mutation endpoints use CSRF tokens
- **Owner protection**: Cannot remove or demote organization owner
- **Self-modification blocked**: Users cannot modify their own membership
- **Invite token security**: Tokens are cryptographically random (32 bytes)

## Accessibility Features

- **Form labels**: All inputs have associated labels (some visually hidden)
- **Loading indicators**: Spinners shown during async operations
- **Confirmation dialogs**: Destructive actions require confirmation
- **Error feedback**: Clear error messages displayed inline
- **Focus management**: Form fields receive focus appropriately

## Configuration

Organization settings in `src/lib/organization.ts`:

| Constant             | Default | Description               |
| -------------------- | ------- | ------------------------- |
| `INVITE_EXPIRY_DAYS` | 7       | Days until invite expires |

## Related Documentation

- [Auth Library](../../lib/README.md) - Authentication and sessions
- [API Examples](../../../docs/API_EXAMPLES.md) - API usage patterns
- [Technical Architecture](../../../docs/TECHNICAL_ARCHITECTURE.md) - System design
- [Database Schema](../../../docs/DATABASE.md) - Organization tables

## Related Pages

- [Invite Accept Page](../invite/[token]/page.tsx) - Public invite acceptance
- [Dashboard](../dashboard/page.tsx) - Redirects here if no organization
