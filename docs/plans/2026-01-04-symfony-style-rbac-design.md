# Symfony-Style RBAC System Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a Symfony-style Role-Based Access Control system with database-backed roles, role hierarchy, and voters for contextual authorization.

**Architecture:** Platform-wide roles stored in database with parent-child hierarchy. Voters handle context-specific authorization (e.g., organization membership). Single `isGranted()` entry point for all permission checks.

**Tech Stack:** Prisma, Next.js API routes, TypeScript

---

## 1. Core Architecture

### Symfony Concepts Applied

| Symfony | SocleStack Implementation |
|---------|---------------------------|
| `ROLE_*` in security.yaml | `Role` database table |
| `role_hierarchy` config | `Role.parentId` self-relation |
| Security Voters | `Voter` interface + implementations |
| `isGranted()` | `isGranted(user, attribute, subject?)` |
| Access Control | Middleware + route guards |

### Design Principles

- Roles are **platform-wide** (not per-organization)
- Role hierarchy is resolved at runtime
- Voters handle **contextual** decisions (can user X do Y on resource Z)
- `OrganizationRole` enum (OWNER/ADMIN/MEMBER) remains for org-level context
- Deny by default if no voter grants access

---

## 2. Database Schema

### New Models

```prisma
model Role {
  id          String   @id @default(cuid())
  name        String   @unique  // "ROLE_ADMIN", "ROLE_MODERATOR"
  description String?
  parentId    String?  @map("parent_id")
  isSystem    Boolean  @default(false) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  parent      Role?    @relation("RoleHierarchy", fields: [parentId], references: [id])
  children    Role[]   @relation("RoleHierarchy")
  users       UserRole[]

  @@map("roles")
}

model UserRole {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  roleId    String   @map("role_id")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
  @@index([userId])
  @@index([roleId])
  @@map("user_roles")
}
```

### User Model Changes

```prisma
model User {
  // ... existing fields ...

  // REMOVE: role Role @default(USER)

  // ADD:
  userRoles UserRole[]
}
```

### Default Roles (Seed Data)

```
ROLE_USER (no parent, isSystem: true)
└── ROLE_MODERATOR (parent: ROLE_USER, isSystem: true)
    └── ROLE_ADMIN (parent: ROLE_MODERATOR, isSystem: true)
```

---

## 3. Security Service

### File: `src/lib/security/index.ts`

```typescript
import { User } from '@prisma/client';
import { prisma } from '@/lib/db';
import { voters } from './voters';
import { VoteResult } from './voter';

/**
 * Main authorization check - like Symfony's isGranted()
 */
export async function isGranted(
  user: User,
  attribute: string,
  subject?: unknown
): Promise<boolean> {
  // Role-based check
  if (attribute.startsWith('ROLE_')) {
    return hasRole(user, attribute);
  }

  // Delegate to voters
  return runVoters(user, attribute, subject);
}

/**
 * Check if user has a role (resolves hierarchy)
 */
export async function hasRole(user: User, role: string): Promise<boolean> {
  const userRoles = await getUserRoleNames(user.id);
  const allRoles = await resolveHierarchy(userRoles);
  return allRoles.has(role);
}

/**
 * Get all role names for a user
 */
async function getUserRoleNames(userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  return userRoles.map((ur) => ur.role.name);
}

/**
 * Resolve role hierarchy - returns all roles including inherited
 */
async function resolveHierarchy(roleNames: string[]): Promise<Set<string>> {
  const allRoles = new Set<string>();
  const roles = await prisma.role.findMany({
    include: { parent: true },
  });

  const roleMap = new Map(roles.map((r) => [r.name, r]));

  function addWithParents(roleName: string) {
    if (allRoles.has(roleName)) return;
    allRoles.add(roleName);

    const role = roleMap.get(roleName);
    if (role?.parent) {
      addWithParents(role.parent.name);
    }
  }

  for (const roleName of roleNames) {
    addWithParents(roleName);
  }

  return allRoles;
}

/**
 * Run voters to determine access
 */
async function runVoters(
  user: User,
  attribute: string,
  subject?: unknown
): Promise<boolean> {
  for (const voter of voters) {
    if (!voter.supports(attribute, subject)) continue;

    const result = await voter.vote(user, attribute, subject);
    if (result === VoteResult.GRANTED) return true;
    if (result === VoteResult.DENIED) return false;
    // ABSTAIN continues to next voter
  }

  return false; // Deny by default
}
```

---

## 4. Voter System

### File: `src/lib/security/voter.ts`

```typescript
import { User } from '@prisma/client';

export enum VoteResult {
  GRANTED = 'granted',
  DENIED = 'denied',
  ABSTAIN = 'abstain',
}

export interface Voter {
  supports(attribute: string, subject?: unknown): boolean;
  vote(user: User, attribute: string, subject?: unknown): Promise<VoteResult>;
}
```

### File: `src/lib/security/voters/organization-voter.ts`

```typescript
import { User, Organization } from '@prisma/client';
import { Voter, VoteResult } from '../voter';
import { hasOrgRole } from '@/lib/organization';

const ATTRIBUTES = [
  'organization.view',
  'organization.edit',
  'organization.delete',
  'organization.members.view',
  'organization.members.manage',
  'organization.invites.manage',
] as const;

type OrgAttribute = typeof ATTRIBUTES[number];

const REQUIRED_ROLES: Record<OrgAttribute, 'MEMBER' | 'ADMIN' | 'OWNER'> = {
  'organization.view': 'MEMBER',
  'organization.edit': 'ADMIN',
  'organization.delete': 'OWNER',
  'organization.members.view': 'MEMBER',
  'organization.members.manage': 'ADMIN',
  'organization.invites.manage': 'ADMIN',
};

export class OrganizationVoter implements Voter {
  supports(attribute: string, subject?: unknown): boolean {
    return (
      ATTRIBUTES.includes(attribute as OrgAttribute) &&
      typeof subject === 'object' &&
      subject !== null &&
      'id' in subject
    );
  }

  async vote(
    user: User,
    attribute: string,
    subject: Organization
  ): Promise<VoteResult> {
    // Must be member of org
    if (user.organizationId !== subject.id) {
      return VoteResult.DENIED;
    }

    const requiredRole = REQUIRED_ROLES[attribute as OrgAttribute];
    if (!requiredRole) {
      return VoteResult.ABSTAIN;
    }

    return hasOrgRole(user.organizationRole, requiredRole)
      ? VoteResult.GRANTED
      : VoteResult.DENIED;
  }
}
```

### File: `src/lib/security/voters/user-voter.ts`

```typescript
import { User } from '@prisma/client';
import { Voter, VoteResult } from '../voter';
import { hasRole } from '../index';

const ATTRIBUTES = [
  'user.view',
  'user.edit',
  'user.delete',
  'user.roles.manage',
] as const;

export class UserVoter implements Voter {
  supports(attribute: string, subject?: unknown): boolean {
    return ATTRIBUTES.includes(attribute as typeof ATTRIBUTES[number]);
  }

  async vote(
    user: User,
    attribute: string,
    subject?: User
  ): Promise<VoteResult> {
    // Self-access always allowed for view/edit
    if (subject && user.id === subject.id) {
      if (attribute === 'user.view' || attribute === 'user.edit') {
        return VoteResult.GRANTED;
      }
      // Cannot delete self or manage own roles
      return VoteResult.DENIED;
    }

    // Admin required for managing other users
    if (await hasRole(user, 'ROLE_ADMIN')) {
      return VoteResult.GRANTED;
    }

    // Moderator can view/edit but not delete or manage roles
    if (await hasRole(user, 'ROLE_MODERATOR')) {
      if (attribute === 'user.view' || attribute === 'user.edit') {
        return VoteResult.GRANTED;
      }
    }

    return VoteResult.DENIED;
  }
}
```

### File: `src/lib/security/voters/index.ts`

```typescript
import { Voter } from '../voter';
import { OrganizationVoter } from './organization-voter';
import { UserVoter } from './user-voter';

export const voters: Voter[] = [
  new OrganizationVoter(),
  new UserVoter(),
];
```

---

## 5. Admin UI

### Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/roles` | `RoleList` | List roles with hierarchy tree |
| `/admin/roles/new` | `RoleEditor` | Create new role |
| `/admin/roles/[id]` | `RoleEditor` | Edit role, view assigned users |

### Role List Features

- Tree view showing hierarchy
- Badge for system roles (non-deletable)
- User count per role
- Click to edit

### Role Editor Features

- Name field (ROLE_* prefix enforced)
- Description field
- Parent role dropdown
- System roles: read-only view
- Assigned users list with remove option

### User Role Assignment

Update existing `/admin` user management:
- Add role multi-select to user edit
- Show inherited roles (greyed out)
- Audit log role changes

---

## 6. API Endpoints

### Role Management (ROLE_ADMIN required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/roles` | List all roles |
| POST | `/api/admin/roles` | Create role |
| GET | `/api/admin/roles/[id]` | Get role details |
| PATCH | `/api/admin/roles/[id]` | Update role |
| DELETE | `/api/admin/roles/[id]` | Delete role (non-system only) |

### User Role Assignment

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/users/[id]/roles` | Get user's roles |
| PUT | `/api/admin/users/[id]/roles` | Set user's roles |

---

## 7. Migration Plan

Since there are no existing users, we'll reset the database:

1. Update `prisma/schema.prisma` with new models
2. Remove `Role` enum and `role` field from User
3. Run `npx prisma db push --force-reset`
4. Create `prisma/seed.ts` with default roles
5. Run `npx prisma db seed`

### Seed Script

```typescript
async function seed() {
  // Create role hierarchy
  const roleUser = await prisma.role.create({
    data: {
      name: 'ROLE_USER',
      description: 'Base role for all authenticated users',
      isSystem: true,
    },
  });

  const roleModerator = await prisma.role.create({
    data: {
      name: 'ROLE_MODERATOR',
      description: 'Can manage users and view reports',
      isSystem: true,
      parentId: roleUser.id,
    },
  });

  await prisma.role.create({
    data: {
      name: 'ROLE_ADMIN',
      description: 'Full platform administration',
      isSystem: true,
      parentId: roleModerator.id,
    },
  });
}
```

---

## 8. Codebase Updates

Replace all existing auth checks:

| Before | After |
|--------|-------|
| `user.role === 'ADMIN'` | `await isGranted(user, 'ROLE_ADMIN')` |
| `user.role !== 'USER'` | `await isGranted(user, 'ROLE_MODERATOR')` |
| `hasOrgRole(user.organizationRole, 'ADMIN')` | `await isGranted(user, 'organization.edit', org)` |

Files requiring updates:
- `src/app/api/admin/**/*.ts` - all admin routes
- `src/app/admin/**/page.tsx` - all admin pages
- `src/middleware.ts` - route protection
- `src/lib/auth.ts` - getCurrentUser enhancements

---

## 9. Testing Strategy

### Unit Tests

- Role hierarchy resolution
- Each voter's vote logic
- `isGranted()` with various scenarios

### Integration Tests

- API endpoint authorization
- Role CRUD operations
- User role assignment

### E2E Tests

- Admin creates custom role
- Admin assigns role to user
- User gains/loses access based on role

---

## 10. Security Considerations

- System roles cannot be deleted or renamed
- Circular hierarchy prevention (check before save)
- Audit logging for all role changes
- Rate limiting on role modification endpoints
- Cannot remove last ROLE_ADMIN user
