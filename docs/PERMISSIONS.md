# Permission Reference

This document describes all permission attributes used by the authorization system.

## Overview

SocleStack uses a hybrid authorization model:

1. **Roles** - Broad access levels (`ROLE_ADMIN`, `ROLE_MODERATOR`, `ROLE_USER`)
2. **Voters** - Fine-grained, contextual permission checks

The `isGranted()` function is the central authorization API:

```typescript
import { isGranted } from '@/lib/security';

// Role check
const isAdmin = await isGranted(user, 'ROLE_ADMIN');

// Permission check with context
const canEdit = await isGranted(user, 'organization.edit', { subject: org });
```

## Authorization Flow

```
isGranted(user, attribute, context)
    │
    ├─▶ If attribute starts with "ROLE_"
    │       └─▶ Check role hierarchy (hasRole)
    │
    └─▶ Otherwise
            └─▶ Find voter that supports attribute
                    └─▶ Voter votes: GRANTED | DENIED | ABSTAIN
```

**Default behavior:** If no voter grants permission, access is **denied** (fail-closed).

---

## Role-Based Permissions

Check if a user has a specific role (resolves hierarchy automatically).

| Role | Inherits From | Description |
|------|---------------|-------------|
| `ROLE_ADMIN` | `ROLE_MODERATOR` | Full platform or organization administration |
| `ROLE_MODERATOR` | `ROLE_USER` | User management capabilities |
| `ROLE_USER` | - | Basic authenticated user |
| `ROLE_OWNER` | - | Organization ownership (for deletion) |

### Role Hierarchy

```
ROLE_ADMIN
    └── ROLE_MODERATOR
            └── ROLE_USER
```

A user with `ROLE_ADMIN` automatically has `ROLE_MODERATOR` and `ROLE_USER` permissions.

### Organization Scoping

Roles can be scoped to specific organizations:

```typescript
// Platform-wide admin (can manage ALL organizations)
await isGranted(user, 'ROLE_ADMIN', { organizationId: null });

// Admin of specific organization only
await isGranted(user, 'ROLE_ADMIN', { organizationId: 'org_123' });

// Check any context (platform OR any org)
await isGranted(user, 'ROLE_ADMIN');
```

---

## Organization Permissions

Handled by `OrganizationVoter`. Requires an organization subject.

| Permission | Required Role | Description |
|------------|---------------|-------------|
| `organization.view` | `ROLE_USER` | View organization details |
| `organization.edit` | `ROLE_ADMIN` | Edit organization settings |
| `organization.manage` | `ROLE_ADMIN` | Manage organization configuration |
| `organization.delete` | `ROLE_OWNER` | Delete the organization |
| `organization.members.view` | `ROLE_USER` | View member list |
| `organization.members.manage` | `ROLE_ADMIN` | Add/remove/modify members |
| `organization.invites.manage` | `ROLE_ADMIN` | Create and manage invitations |

### Subject Requirements

The subject must be an object with `id` and `slug` properties:

```typescript
interface OrganizationSubject {
  id: string;
  slug: string;
}
```

### Usage Examples

```typescript
import { isGranted } from '@/lib/security';

// Fetch organization
const org = await prisma.organization.findUnique({
  where: { id: orgId },
  select: { id: true, slug: true }
});

// Check permissions
const canView = await isGranted(user, 'organization.view', { subject: org });
const canEdit = await isGranted(user, 'organization.edit', { subject: org });
const canDelete = await isGranted(user, 'organization.delete', { subject: org });

// In a route handler
if (!await isGranted(user, 'organization.members.manage', { subject: org })) {
  return NextResponse.json(
    { error: { type: 'AUTHORIZATION_ERROR', message: 'Insufficient permissions' } },
    { status: 403 }
  );
}
```

### Special Rules

- **Platform admins** (`ROLE_ADMIN` with `organizationId: null`) can manage ANY organization
- Organization-scoped roles only apply within that organization

---

## User Permissions

Handled by `UserVoter`. Requires a user subject.

| Permission | Self | MODERATOR | ADMIN | Description |
|------------|------|-----------|-------|-------------|
| `user.view` | ✅ | ✅ | ✅ | View user profile |
| `user.edit` | ✅ | ✅ | ✅ | Edit user profile |
| `user.delete` | ❌ | ❌ | ✅ | Delete user account |
| `user.roles.manage` | ❌ | ❌ | ✅ | Assign/remove roles |

### Subject Requirements

The subject must be an object with an `id` property:

```typescript
interface UserSubject {
  id: string;
}
```

### Usage Examples

```typescript
import { isGranted } from '@/lib/security';

// Fetch target user
const targetUser = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true }
});

// Check permissions
const canView = await isGranted(currentUser, 'user.view', { subject: targetUser });
const canEdit = await isGranted(currentUser, 'user.edit', { subject: targetUser });
const canDelete = await isGranted(currentUser, 'user.delete', { subject: targetUser });
const canManageRoles = await isGranted(currentUser, 'user.roles.manage', { subject: targetUser });

// Self-access is automatically granted for view/edit
if (currentUser.id === targetUser.id) {
  // user.view and user.edit will return true
  // user.delete and user.roles.manage will return false (can't self-delete or self-promote)
}
```

### Special Rules

- Users can **always** view and edit their own profile
- Users can **never** delete themselves or manage their own roles
- `ROLE_MODERATOR` can view/edit other users but not delete or manage roles
- `ROLE_ADMIN` can perform all user operations

---

## Adding Custom Permissions

To add new permissions, create a voter:

```typescript
// src/lib/security/voters/document-voter.ts
import type { Voter } from '../voter';
import { VoteResult } from '../voter';
import type { UserWithRoles } from '../role-checker';
import { hasRole } from '../role-checker';
import { ROLE_NAMES as ROLES } from '@/lib/constants/roles';

const ATTRIBUTES = [
  'document.view',
  'document.edit',
  'document.delete',
] as const;

interface DocumentSubject {
  id: string;
  ownerId: string;
}

export class DocumentVoter implements Voter {
  supports(attribute: string, subject?: unknown): boolean {
    return (
      ATTRIBUTES.includes(attribute as typeof ATTRIBUTES[number]) &&
      this.isDocument(subject)
    );
  }

  async vote(
    user: UserWithRoles,
    attribute: string,
    subject?: unknown
  ): Promise<VoteResult> {
    const doc = subject as DocumentSubject;

    // Owner can do anything
    if (doc.ownerId === user.id) {
      return VoteResult.GRANTED;
    }

    // Admin can do anything
    if (await hasRole(user, ROLES.ADMIN)) {
      return VoteResult.GRANTED;
    }

    return VoteResult.DENIED;
  }

  private isDocument(subject: unknown): subject is DocumentSubject {
    return (
      typeof subject === 'object' &&
      subject !== null &&
      'id' in subject &&
      'ownerId' in subject
    );
  }
}
```

Register in `src/lib/security/voters/index.ts`:

```typescript
import { documentVoter } from './document-voter';

export const voters: Voter[] = [
  organizationVoter,
  userVoter,
  documentVoter,  // Add new voter
];
```

---

## Quick Reference

### All Permissions

| Permission | Voter | Required Role | Subject |
|------------|-------|---------------|---------|
| `ROLE_*` | - | Role hierarchy | - |
| `organization.view` | OrganizationVoter | ROLE_USER | Organization |
| `organization.edit` | OrganizationVoter | ROLE_ADMIN | Organization |
| `organization.manage` | OrganizationVoter | ROLE_ADMIN | Organization |
| `organization.delete` | OrganizationVoter | ROLE_OWNER | Organization |
| `organization.members.view` | OrganizationVoter | ROLE_USER | Organization |
| `organization.members.manage` | OrganizationVoter | ROLE_ADMIN | Organization |
| `organization.invites.manage` | OrganizationVoter | ROLE_ADMIN | Organization |
| `user.view` | UserVoter | Self/MODERATOR/ADMIN | User |
| `user.edit` | UserVoter | Self/MODERATOR/ADMIN | User |
| `user.delete` | UserVoter | ADMIN | User |
| `user.roles.manage` | UserVoter | ADMIN | User |

### Common Patterns

```typescript
// Route handler with permission check
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const org = await getOrganization(orgId);
  if (!await isGranted(user, 'organization.edit', { subject: org })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Proceed with edit...
}

// UI conditional rendering
const canManageMembers = await isGranted(user, 'organization.members.manage', { subject: org });
if (canManageMembers) {
  // Show member management UI
}
```

---

## Related Documentation

- [Security Architecture](./TECHNICAL_ARCHITECTURE.md#security)
