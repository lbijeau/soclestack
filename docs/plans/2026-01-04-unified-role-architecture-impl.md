# Unified Dynamic Role Architecture - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Unify platform and organization roles into a single context-aware RBAC system with tenant scoping.

**Architecture:** Add `organizationId` to `UserRole` for context-aware role assignments. Platform-wide roles (`org=null`) work everywhere. Org-scoped roles only work in their organization. Update `isGranted()` to accept context parameter.

**Tech Stack:** Prisma, TypeScript, Next.js, Vitest, Symfony-style voters

---

## Phase 1: Schema & Core Infrastructure

### Task 1.1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add organizationId to UserRole table**

Add `organizationId` field and update relations:

```prisma
model UserRole {
  id             String    @id @default(cuid())
  userId         String    @map("user_id")
  roleId         String    @map("role_id")
  organizationId String?   @map("organization_id") // NULL = platform-wide
  createdAt      DateTime  @default(now()) @map("created_at")

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  role         Role          @relation(fields: [roleId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId, organizationId])
  @@index([userId])
  @@index([roleId])
  @@index([organizationId])
  @@map("user_roles")
}
```

**Step 2: Remove organizationRole from User table**

Find and remove these fields from User model:

```prisma
model User {
  id String @id @default(cuid())
  // ... other fields ...

  // REMOVE these lines:
  // organizationRole OrganizationRole @default(MEMBER) @map("organization_role")
  // organizationId String? @map("organization_id")
  // organization Organization? @relation(fields: [organizationId], references: [id])

  userRoles UserRole[] // Keep this

  @@map("users")
}
```

**Step 3: Add UserRole relation to Organization**

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  userRoles UserRole[] // Add this line
  invites   OrganizationInvite[]

  @@map("organizations")
}
```

**Step 4: Remove OrganizationRole enum**

Delete the entire enum definition:

```prisma
// DELETE this entire block:
// enum OrganizationRole {
//   OWNER
//   ADMIN
//   MEMBER
// }
```

**Step 5: Create migration**

Run: `npx prisma migrate dev --name unified-role-architecture`

Expected: Migration created successfully, schema updated

**Step 6: Add partial unique index for NULL organizationId**

Add migration step to handle NULL uniqueness (Postgres treats NULL != NULL):

Create new migration file manually or add to the generated migration:

```sql
-- Partial unique index for platform-wide roles (organizationId IS NULL)
CREATE UNIQUE INDEX user_roles_user_role_platform_unique
ON user_roles (user_id, role_id)
WHERE organization_id IS NULL;
```

In Prisma schema, document this with a comment:

```prisma
model UserRole {
  // ... fields ...

  @@unique([userId, roleId, organizationId])
  // NOTE: Additional partial unique index in migration for organizationId IS NULL
  @@index([userId])
  @@index([roleId])
  @@index([organizationId])
  @@map("user_roles")
}
```

**Step 7: Commit schema changes**

```bash
git add prisma/schema.prisma
git add prisma/migrations/
git commit -m "feat(schema): add organizationId to UserRole with NULL-safe uniqueness

- Add organizationId field to UserRole (nullable for platform-wide roles)
- Add unique constraint on (userId, roleId, organizationId)
- Add partial unique index for platform-wide roles (org IS NULL)
- Remove organizationRole and organizationId from User table
- Remove OrganizationRole enum
- Add UserRole relation to Organization

Fixes NULL uniqueness issue per code review feedback.

Refs #183, #229"
```

---

### Task 1.2: Create Shared Role Constants Module

**Files:**
- Create: `src/lib/constants/roles.ts`
- Create: `src/lib/constants/index.ts`

**Step 1: Create role constants module**

Create `src/lib/constants/roles.ts`:

```typescript
/**
 * Shared role name constants
 * Use these constants across frontend and backend to avoid typos and drift
 */

export const ROLE_NAMES = {
  ADMIN: 'ROLE_ADMIN',
  MODERATOR: 'ROLE_MODERATOR',
  USER: 'ROLE_USER',
  OWNER: 'ROLE_OWNER',
  EDITOR: 'ROLE_EDITOR',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

/**
 * Role hierarchy levels (for UI display ordering)
 */
export const ROLE_HIERARCHY: Record<RoleName, number> = {
  [ROLE_NAMES.OWNER]: 4,
  [ROLE_NAMES.ADMIN]: 3,
  [ROLE_NAMES.MODERATOR]: 2,
  [ROLE_NAMES.USER]: 1,
  [ROLE_NAMES.EDITOR]: 1,
};

/**
 * Check if a string is a valid role name
 */
export function isValidRoleName(name: string): name is RoleName {
  return Object.values(ROLE_NAMES).includes(name as RoleName);
}

/**
 * Validate role name format: ROLE_[A-Z][A-Z0-9_]+ (min 2 chars after prefix)
 */
export function validateRoleNameFormat(name: string): boolean {
  return /^ROLE_[A-Z][A-Z0-9_]+$/.test(name) && name.length > 7; // "ROLE_" + 2 chars min
}
```

**Step 2: Create barrel export**

Create `src/lib/constants/index.ts`:

```typescript
export * from './roles';
```

**Step 3: Update security/index.ts to use shared constants**

In `src/lib/security/index.ts`, replace:

```typescript
// OLD
export const ROLES = {
  ADMIN: 'ROLE_ADMIN',
  MODERATOR: 'ROLE_MODERATOR',
  USER: 'ROLE_USER',
} as const;

// NEW
import { ROLE_NAMES } from '@/lib/constants/roles';

export const ROLES = ROLE_NAMES; // Re-export for backward compatibility
```

**Step 4: Commit role constants**

```bash
git add src/lib/constants/
git add src/lib/security/index.ts
git commit -m "feat(constants): create shared role constants module

- Centralize role names to prevent frontend/backend drift
- Add role hierarchy levels for UI ordering
- Add role name validation helpers
- Update security module to use shared constants

Addresses code review feedback on consistency.

Refs #183, #230"
```

---

### Task 1.3: Update Seed Data

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Update role seeding to include organization roles**

Replace existing role seeding code with hierarchy including ROLE_OWNER:

```typescript
async function seedRoles() {
  console.log('Seeding roles...');

  // Base role - all users have this
  const roleUser = await prisma.role.upsert({
    where: { name: 'ROLE_USER' },
    update: {},
    create: {
      name: 'ROLE_USER',
      description: 'Basic platform access',
      isSystem: true,
    },
  });

  // Moderator inherits from USER
  const roleModerator = await prisma.role.upsert({
    where: { name: 'ROLE_MODERATOR' },
    update: {},
    create: {
      name: 'ROLE_MODERATOR',
      description: 'Content moderation capabilities',
      isSystem: true,
      parentId: roleUser.id,
    },
  });

  // Admin inherits from MODERATOR
  const roleAdmin = await prisma.role.upsert({
    where: { name: 'ROLE_ADMIN' },
    update: {},
    create: {
      name: 'ROLE_ADMIN',
      description: 'Full administrative access',
      isSystem: true,
      parentId: roleModerator.id,
    },
  });

  // Owner inherits from ADMIN (highest org-level role)
  const roleOwner = await prisma.role.upsert({
    where: { name: 'ROLE_OWNER' },
    update: {},
    create: {
      name: 'ROLE_OWNER',
      description: 'Organization owner',
      isSystem: true,
      parentId: roleAdmin.id,
    },
  });

  // Editor - custom role example
  await prisma.role.upsert({
    where: { name: 'ROLE_EDITOR' },
    update: {},
    create: {
      name: 'ROLE_EDITOR',
      description: 'Content editor',
      isSystem: false,
      parentId: roleUser.id,
    },
  });

  console.log('✓ Roles seeded');
}
```

**Step 2: Update user role assignments with context**

Find user role assignment code and update to include organizationId:

```typescript
// Example: Assign platform-wide admin (super admin)
await prisma.userRole.create({
  data: {
    userId: adminUser.id,
    roleId: roleAdmin.id,
    organizationId: null, // Platform-wide
  },
});

// Example: Assign org-scoped owner
await prisma.userRole.create({
  data: {
    userId: ownerUser.id,
    roleId: roleOwner.id,
    organizationId: organization.id, // Scoped to org
  },
});
```

**Step 3: Run seed**

Run: `npx prisma db seed`

Expected: Seed completes successfully with new role structure

**Step 4: Commit seed changes**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): update role seeding with ROLE_OWNER and context-aware assignments

- Add ROLE_OWNER role (inherits from ROLE_ADMIN)
- Update role assignments to include organizationId context
- Support platform-wide (null) and org-scoped assignments

Refs #183"
```

---

### Task 1.4: Update NextAuth Session Configuration

**Files:**
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts` (or wherever NextAuth config is)

**Step 1: Write test for session including userRoles**

Create `tests/unit/auth-session.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Session } from 'next-auth';

describe('NextAuth Session', () => {
  it('session user should include userRoles', () => {
    const mockSession: Session = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        userRoles: [
          {
            role: { id: 'role-1', name: 'ROLE_ADMIN', parentId: null },
            organizationId: null,
          },
        ],
      },
      expires: '2026-12-31',
    };

    expect(mockSession.user.userRoles).toBeDefined();
    expect(mockSession.user.userRoles).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit tests/unit/auth-session.spec.ts`

Expected: TypeScript error - userRoles doesn't exist on User type

**Step 3: Extend NextAuth types**

In `src/types/next-auth.d.ts`:

```typescript
import 'next-auth';
import type { Role } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      userRoles?: Array<{
        role: {
          id: string;
          name: string;
          parentId: string | null;
        };
        organizationId: string | null;
      }>;
    };
  }

  interface User {
    id: string;
    email: string;
    userRoles?: Array<{
      role: {
        id: string;
        name: string;
        parentId: string | null;
      };
      organizationId: string | null;
    }>;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    userRoles?: Array<{
      role: {
        id: string;
        name: string;
        parentId: string | null;
      };
      organizationId: string | null;
    }>;
  }
}
```

**Step 4: Update session callback to include userRoles**

In `src/lib/auth.ts` (or auth config file), update callbacks:

```typescript
import { prisma } from '@/lib/db';
import { userWithRolesInclude } from '@/lib/security/index';

export const authOptions: NextAuthOptions = {
  // ... other config ...
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;

        // Fetch user with roles
        const userWithRoles = await prisma.user.findUnique({
          where: { id: user.id },
          include: userWithRolesInclude,
        });

        if (userWithRoles) {
          token.userRoles = userWithRoles.userRoles.map((ur) => ({
            role: {
              id: ur.role.id,
              name: ur.role.name,
              parentId: ur.role.parentId,
            },
            organizationId: ur.organizationId,
          }));
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.userRoles = token.userRoles as any;
      }
      return session;
    },
  },
};
```

**Step 5: Run test to verify it passes**

Run: `npm run test:unit tests/unit/auth-session.spec.ts`

Expected: PASS - TypeScript accepts userRoles

**Step 6: Commit NextAuth changes**

```bash
git add src/types/next-auth.d.ts src/lib/auth.ts tests/unit/auth-session.spec.ts
git commit -m "feat(auth): add userRoles to NextAuth session

- Extend NextAuth Session/User/JWT types with userRoles
- Update jwt callback to fetch and include user roles
- Update session callback to pass userRoles to client
- Add test for session type safety

Critical fix per code review - enables frontend role checks.

Refs #183, #231"
```

---

### Task 1.5: Verify getCurrentUser Includes UserRoles

**Files:**
- Modify: `src/lib/auth.ts` (or wherever getCurrentUser is defined)
- Test: `tests/unit/get-current-user.spec.ts`

**Step 1: Write test for getCurrentUser returning userRoles**

Create `tests/unit/get-current-user.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include userRoles relation', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com' },
    };

    const mockUserWithRoles = {
      id: 'user-123',
      email: 'test@example.com',
      userRoles: [
        {
          role: { id: 'role-1', name: 'ROLE_ADMIN', parentId: null },
          organizationId: null,
        },
      ],
    };

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles as any);

    const user = await getCurrentUser();

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      include: {
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                parentId: true,
              },
            },
          },
        },
      },
    });

    expect(user?.userRoles).toBeDefined();
  });
});
```

**Step 2: Run test to verify current behavior**

Run: `npm run test:unit tests/unit/get-current-user.spec.ts`

Expected: May FAIL if getCurrentUser doesn't include userRoles

**Step 3: Update getCurrentUser to include userRoles**

In `src/lib/auth.ts`:

```typescript
import { userWithRolesInclude } from '@/lib/security/index';

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: userWithRolesInclude, // Ensure this is included!
  });

  return user;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit tests/unit/get-current-user.spec.ts`

Expected: PASS - getCurrentUser includes userRoles

**Step 5: Commit getCurrentUser fix**

```bash
git add src/lib/auth.ts tests/unit/get-current-user.spec.ts
git commit -m "fix(auth): ensure getCurrentUser includes userRoles relation

- Update getCurrentUser to include userRoles with role details
- Use userWithRolesInclude for consistent query structure
- Add test to verify userRoles are loaded

Critical fix per code review - enables API RBAC checks.

Refs #183, #232"
```

---

### Task 1.6: Create Data Migration Script (Alternative to Reset)

**Files:**
- Create: `prisma/migrations/data-migration-org-roles.ts`

**Step 1: Create data migration script**

Create migration script:

```typescript
/**
 * Data migration: Convert User.organizationRole to UserRole records
 *
 * Run this BEFORE applying the schema migration if you have existing data.
 *
 * Usage:
 *   npx tsx prisma/migrations/data-migration-org-roles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting data migration: organizationRole -> UserRole');

  // Get all roles
  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map(r => [r.name, r]));

  // Get role IDs
  const adminRole = roleMap.get('ROLE_ADMIN');
  const ownerRole = roleMap.get('ROLE_OWNER');
  const userRole = roleMap.get('ROLE_USER');

  if (!adminRole || !ownerRole || !userRole) {
    throw new Error('System roles not found. Run seed first.');
  }

  // Map OrganizationRole enum to Role IDs
  const orgRoleToRoleId = {
    OWNER: ownerRole.id,
    ADMIN: adminRole.id,
    MEMBER: userRole.id,
  };

  // Get all users with organizationRole (before schema change)
  const users = await prisma.$queryRaw<
    Array<{ id: string; organization_id: string | null; organization_role: string }>
  >`
    SELECT id, organization_id, organization_role
    FROM users
    WHERE organization_id IS NOT NULL
  `;

  console.log(`Found ${users.length} users with organization assignments`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    const roleId = orgRoleToRoleId[user.organization_role as keyof typeof orgRoleToRoleId];

    if (!roleId) {
      console.warn(`Unknown role: ${user.organization_role} for user ${user.id}`);
      skipped++;
      continue;
    }

    // Create UserRole record
    try {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: roleId,
          organizationId: user.organization_id,
        },
      });
      migrated++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - already migrated
        skipped++;
      } else {
        throw error;
      }
    }
  }

  console.log(`Migration complete:`);
  console.log(`  - Migrated: ${migrated}`);
  console.log(`  - Skipped: ${skipped}`);
  console.log(`  - Total: ${users.length}`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Document migration process**

Add to migration guide in `docs/guides/unified-role-migration.md`:

```markdown
## Data Migration (If You Have Existing Users)

If your environment has existing user data with `organizationRole` assignments:

### Step 1: Backup Database
```bash
# Postgres backup
pg_dump your_database > backup.sql
```

### Step 2: Run Data Migration Script
```bash
# Before applying schema migration!
npx tsx prisma/migrations/data-migration-org-roles.ts
```

### Step 3: Apply Schema Migration
```bash
npx prisma migrate deploy
```

### Step 4: Verify Migration
```sql
SELECT COUNT(*) FROM user_roles; -- Should match user count
SELECT * FROM users WHERE organization_id IS NOT NULL; -- Should be empty after migration
```
```

**Step 3: Commit migration script**

```bash
git add prisma/migrations/data-migration-org-roles.ts
git add docs/guides/unified-role-migration.md
git commit -m "feat(migration): add data migration script for organizationRole

- Create script to convert User.organizationRole to UserRole records
- Preserve existing organization memberships
- Add migration instructions to guide
- Alternative to database reset for environments with data

Addresses code review feedback on data preservation.

Refs #183, #233"
```

---

### Task 1.7: Update Security Core - Context Parameter

**Files:**
- Modify: `src/lib/security/index.ts`
- Test: `tests/unit/rbac-security.spec.ts`

**Step 1: Write failing test for context-aware isGranted**

Add to `tests/unit/rbac-security.spec.ts`:

```typescript
describe('isGranted with context', () => {
  let isGranted: typeof import('@/lib/security/index').isGranted;

  beforeEach(async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue(mockRolesWithHierarchy);
    const module = await import('@/lib/security/index');
    isGranted = module.isGranted;
    module.clearRoleHierarchyCache();
  });

  it('should accept organizationId in context parameter', async () => {
    const user = createMockUser([ROLES.ADMIN]);

    // Should not throw with context parameter
    const result = await isGranted(user, ROLES.ADMIN, {
      organizationId: 'org-123',
    });

    expect(result).toBe(true);
  });

  it('should pass context to hasRole when checking ROLE_* attributes', async () => {
    const hasRoleSpy = vi.spyOn(
      await import('@/lib/security/index'),
      'hasRole'
    );

    const user = createMockUser([ROLES.ADMIN]);
    await isGranted(user, ROLES.ADMIN, { organizationId: 'org-123' });

    expect(hasRoleSpy).toHaveBeenCalledWith(
      user,
      ROLES.ADMIN,
      'org-123'
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit tests/unit/rbac-security.spec.ts`

Expected: FAIL - isGranted doesn't accept context parameter

**Step 3: Update isGranted signature**

In `src/lib/security/index.ts`, update the `isGranted` function:

```typescript
/**
 * Main authorization check - like Symfony's isGranted()
 *
 * Uses affirmative voting strategy: first voter to GRANT wins.
 * If no voter grants, returns false (denied by default).
 *
 * @param user - User object (must include userRoles relation)
 * @param attribute - Role name (e.g., 'ROLE_ADMIN') or permission (e.g., 'organization.edit')
 * @param context - Optional context (organizationId, subject for voters)
 */
export async function isGranted(
  user: UserWithRoles | null,
  attribute: string,
  context?: {
    organizationId?: string | null;
    subject?: unknown;
  }
): Promise<boolean> {
  if (!user) return false;

  // Role-based check (ROLE_* attributes)
  if (attribute.startsWith('ROLE_')) {
    return hasRole(user, attribute, context?.organizationId);
  }

  // ... rest of voter logic (update in next step)
}
```

**Step 4: Update hasRole signature to accept organizationId**

```typescript
/**
 * Check if user has a specific role (resolves hierarchy)
 *
 * @param organizationId - Organization context (null = platform-wide, undefined = any)
 */
export async function hasRole(
  user: UserWithRoles | null,
  roleName: string,
  organizationId?: string | null
): Promise<boolean> {
  if (!user) return false;

  const userRoleNames = getUserRoleNames(user, organizationId);
  if (userRoleNames.length === 0) return false;

  const allRoles = await resolveHierarchy(userRoleNames);
  return allRoles.has(roleName);
}
```

**Step 5: Update getUserRoleNames to filter by organizationId**

```typescript
/**
 * Get user's directly assigned role names, filtered by organization context
 *
 * @param organizationId - Filter by org context:
 *   - undefined: Return roles from ALL contexts
 *   - null: Return only platform-wide roles (organizationId = null)
 *   - string: Return roles for that org + platform-wide roles
 */
function getUserRoleNames(
  user: UserWithRoles,
  organizationId?: string | null
): string[] {
  if (!user.userRoles || user.userRoles.length === 0) {
    return [];
  }

  // Filter by organization context
  const filteredRoles = user.userRoles.filter((ur) => {
    if (organizationId === undefined) {
      // No filter - all roles
      return true;
    }

    // Platform-wide roles (null) work everywhere
    if (ur.organizationId === null) {
      return true;
    }

    // Org-specific roles must match
    return ur.organizationId === organizationId;
  });

  return filteredRoles.map((ur) => ur.role.name);
}
```

**Step 6: Run tests to verify they pass**

Run: `npm run test:unit tests/unit/rbac-security.spec.ts`

Expected: PASS - all tests pass

**Step 7: Commit security core changes**

```bash
git add src/lib/security/index.ts tests/unit/rbac-security.spec.ts
git commit -m "feat(security): add context parameter to isGranted and hasRole

- Add optional context parameter to isGranted() with organizationId
- Update hasRole() to filter roles by organization context
- Update getUserRoleNames() to support context filtering
- Platform-wide roles (org=null) work in all contexts

Refs #183"
```

---

### Task 1.4: Add Context-Aware Role Tests

**Files:**
- Test: `tests/unit/rbac-security.spec.ts`

**Step 1: Write tests for platform-wide super admin**

Add test suite:

```typescript
describe('hasRole with organization context', () => {
  let hasRole: typeof import('@/lib/security/index').hasRole;

  beforeEach(async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue(mockRolesWithHierarchy);
    const module = await import('@/lib/security/index');
    hasRole = module.hasRole;
    module.clearRoleHierarchyCache();
  });

  it('platform-wide admin (org=null) works in all orgs', async () => {
    const superAdmin = {
      id: 'super-admin',
      userRoles: [
        {
          role: { id: 'role-admin', name: ROLES.ADMIN, parentId: null },
          organizationId: null, // Platform-wide
        },
      ],
    };

    // Should work with null context (platform check)
    expect(await hasRole(superAdmin, ROLES.ADMIN, null)).toBe(true);

    // Should work with any org context (super admin)
    expect(await hasRole(superAdmin, ROLES.ADMIN, 'org-123')).toBe(true);
    expect(await hasRole(superAdmin, ROLES.ADMIN, 'org-456')).toBe(true);
  });

  it('org-scoped admin only works in their org', async () => {
    const orgAdmin = {
      id: 'org-admin',
      userRoles: [
        {
          role: { id: 'role-admin', name: ROLES.ADMIN, parentId: null },
          organizationId: 'org-123', // Scoped to org-123
        },
      ],
    };

    // Should work in their org
    expect(await hasRole(orgAdmin, ROLES.ADMIN, 'org-123')).toBe(true);

    // Should NOT work in different org
    expect(await hasRole(orgAdmin, ROLES.ADMIN, 'org-456')).toBe(false);

    // Should NOT work in platform context
    expect(await hasRole(orgAdmin, ROLES.ADMIN, null)).toBe(false);
  });

  it('undefined context checks ANY assignment', async () => {
    const user = {
      id: 'user',
      userRoles: [
        {
          role: { id: 'role-admin', name: ROLES.ADMIN, parentId: null },
          organizationId: 'org-123',
        },
      ],
    };

    // No context specified - should find the role
    expect(await hasRole(user, ROLES.ADMIN, undefined)).toBe(true);
    expect(await hasRole(user, ROLES.ADMIN)).toBe(true);
  });

  it('user with multiple org roles', async () => {
    const multiOrgUser = {
      id: 'multi-org',
      userRoles: [
        {
          role: { id: 'role-admin', name: ROLES.ADMIN, parentId: null },
          organizationId: 'org-123', // Admin in org-123
        },
        {
          role: { id: 'role-user', name: ROLES.USER, parentId: null },
          organizationId: 'org-456', // User in org-456
        },
      ],
    };

    // Admin in org-123
    expect(await hasRole(multiOrgUser, ROLES.ADMIN, 'org-123')).toBe(true);

    // Only user in org-456
    expect(await hasRole(multiOrgUser, ROLES.ADMIN, 'org-456')).toBe(false);
    expect(await hasRole(multiOrgUser, ROLES.USER, 'org-456')).toBe(true);
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npm run test:unit tests/unit/rbac-security.spec.ts`

Expected: PASS - all context-aware tests pass

**Step 3: Commit context tests**

```bash
git add tests/unit/rbac-security.spec.ts
git commit -m "test(security): add tests for context-aware role checking

- Test platform-wide super admin (org=null) works everywhere
- Test org-scoped roles only work in their org
- Test undefined context checks ANY assignment
- Test user with roles in multiple orgs

Refs #183"
```

---

### Task 1.5: Update Voter Interface

**Files:**
- Modify: `src/lib/security/voter.ts`
- Modify: `src/lib/security/voters/organization-voter.ts`
- Modify: `src/lib/security/voters/user-voter.ts`

**Step 1: Update Voter interface to accept context**

In `src/lib/security/voter.ts`:

```typescript
export interface Voter {
  /**
   * Check if this voter handles the given attribute
   */
  supports(attribute: string, subject?: unknown): Promise<boolean>;

  /**
   * Vote on the authorization decision
   *
   * @param user - User making the request
   * @param attribute - Permission being checked
   * @param subject - Subject being acted upon
   * @param context - Optional context (organizationId, etc.)
   */
  vote(
    user: UserWithRoles,
    attribute: string,
    subject: unknown,
    context?: { organizationId?: string | null }
  ): Promise<VoteResult>;
}
```

**Step 2: Update isGranted to pass context to voters**

In `src/lib/security/index.ts`, update the voter loop:

```typescript
// Voter-based checks for contextual permissions
for (let i = 0; i < voters.length; i++) {
  const voter = voters[i];
  const voterName = VOTER_NAMES[i];
  const supports = await voter.supports(attribute, context?.subject);
  if (supports) {
    voterCache.set(attribute, i);
    const result = await voter.vote(user, attribute, context?.subject, {
      organizationId: context?.organizationId,
    });
    log.debug('voter decision', {
      voterName,
      attribute,
      result,
      userId: user.id,
      organizationId: context?.organizationId,
    });
    if (result === VoteResult.GRANTED) {
      return true;
    }
    if (result === VoteResult.DENIED) {
      return false;
    }
    // ABSTAIN continues to next voter
  }
}
```

**Step 3: Update OrganizationVoter to use context**

In `src/lib/security/voters/organization-voter.ts`:

```typescript
import { VoteResult, type Voter } from '../voter';
import { hasRole, type UserWithRoles } from '../index';
import type { Organization } from '@prisma/client';

export class OrganizationVoter implements Voter {
  async supports(attribute: string, subject?: unknown): Promise<boolean> {
    return (
      attribute.startsWith('organization.') &&
      subject !== undefined &&
      typeof subject === 'object' &&
      subject !== null &&
      'id' in subject
    );
  }

  async vote(
    user: UserWithRoles,
    attribute: string,
    subject: unknown,
    context?: { organizationId?: string | null }
  ): Promise<VoteResult> {
    const org = subject as Organization;

    // Use organization ID from subject for context
    const orgId = org.id;

    // Check for OWNER role in this org
    const hasOwner = await hasRole(user, 'ROLE_OWNER', orgId);

    // Check for ADMIN role in this org (or platform-wide)
    const hasAdmin = await hasRole(user, 'ROLE_ADMIN', orgId);

    switch (attribute) {
      case 'organization.delete':
        // Only owners can delete
        return hasOwner ? VoteResult.GRANTED : VoteResult.DENIED;

      case 'organization.manage':
      case 'organization.edit':
        // Admins and owners can manage
        return hasAdmin || hasOwner ? VoteResult.GRANTED : VoteResult.DENIED;

      case 'organization.view':
        // Any user in the org can view (has any role in this org)
        const hasAnyRole = await hasRole(user, 'ROLE_USER', orgId);
        return hasAnyRole ? VoteResult.GRANTED : VoteResult.DENIED;

      default:
        return VoteResult.ABSTAIN;
    }
  }
}
```

**Step 4: Update UserVoter to use context**

In `src/lib/security/voters/user-voter.ts`:

```typescript
import { VoteResult, type Voter } from '../voter';
import { hasRole, type UserWithRoles } from '../index';
import type { User } from '@prisma/client';

export class UserVoter implements Voter {
  async supports(attribute: string, subject?: unknown): Promise<boolean> {
    return (
      attribute.startsWith('user.') &&
      subject !== undefined &&
      typeof subject === 'object' &&
      subject !== null &&
      'id' in subject
    );
  }

  async vote(
    user: UserWithRoles,
    attribute: string,
    subject: unknown,
    context?: { organizationId?: string | null }
  ): Promise<VoteResult> {
    const targetUser = subject as User;

    // Users can always edit themselves
    if (attribute === 'user.edit' && user.id === targetUser.id) {
      return VoteResult.GRANTED;
    }

    // Platform admins can edit any user
    const isPlatformAdmin = await hasRole(user, 'ROLE_ADMIN', null);
    if (isPlatformAdmin) {
      return VoteResult.GRANTED;
    }

    // Org admins can edit users in their org
    if (context?.organizationId) {
      const isOrgAdmin = await hasRole(
        user,
        'ROLE_ADMIN',
        context.organizationId
      );
      if (isOrgAdmin) {
        return VoteResult.GRANTED;
      }
    }

    return VoteResult.DENIED;
  }
}
```

**Step 5: Run tests**

Run: `npm run test:unit`

Expected: All tests pass (voters updated to new signature)

**Step 6: Commit voter updates**

```bash
git add src/lib/security/voter.ts src/lib/security/voters/
git commit -m "feat(security): update voters to accept organization context

- Add context parameter to Voter.vote() interface
- Update OrganizationVoter to check roles with org context
- Update UserVoter to support org-scoped admin checks
- Pass organizationId from isGranted to voters

Refs #183"
```

---

## Phase 2: API Layer Updates

### Task 2.1: Create API Helper Utilities

**Files:**
- Create: `src/lib/api-utils.ts`
- Test: `tests/unit/api-utils.spec.ts`

**Step 1: Write failing test for requireAdmin helper**

Create `tests/unit/api-utils.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdmin, requireModerator } from '@/lib/api-utils';
import type { UserWithRoles } from '@/lib/security/index';

vi.mock('@/lib/security/index', () => ({
  hasRole: vi.fn(),
}));

import { hasRole } from '@/lib/security/index';

describe('API Utils', () => {
  const mockUser: UserWithRoles = {
    id: 'user-123',
    userRoles: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAdmin', () => {
    it('returns true when user has platform-wide admin', async () => {
      vi.mocked(hasRole).mockResolvedValue(true);

      const result = await requireAdmin(mockUser, null);

      expect(result).toBe(true);
      expect(hasRole).toHaveBeenCalledWith(mockUser, 'ROLE_ADMIN', null);
    });

    it('returns true when user has org-scoped admin', async () => {
      vi.mocked(hasRole).mockResolvedValue(true);

      const result = await requireAdmin(mockUser, 'org-123');

      expect(result).toBe(true);
      expect(hasRole).toHaveBeenCalledWith(mockUser, 'ROLE_ADMIN', 'org-123');
    });

    it('returns false when user is not admin', async () => {
      vi.mocked(hasRole).mockResolvedValue(false);

      const result = await requireAdmin(mockUser, 'org-123');

      expect(result).toBe(false);
    });
  });

  describe('requireModerator', () => {
    it('returns true when user has moderator role', async () => {
      vi.mocked(hasRole).mockResolvedValue(true);

      const result = await requireModerator(mockUser, 'org-123');

      expect(result).toBe(true);
      expect(hasRole).toHaveBeenCalledWith(
        mockUser,
        'ROLE_MODERATOR',
        'org-123'
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit tests/unit/api-utils.spec.ts`

Expected: FAIL - requireAdmin not defined

**Step 3: Implement requireAdmin and requireModerator**

Create `src/lib/api-utils.ts`:

```typescript
import { hasRole, type UserWithRoles } from '@/lib/security/index';

/**
 * Check if user has ROLE_ADMIN in the given organization context
 *
 * @param user - User to check
 * @param organizationId - Organization context (null = platform-wide, undefined = any)
 * @returns true if user is admin in the given context
 */
export async function requireAdmin(
  user: UserWithRoles | null,
  organizationId?: string | null
): Promise<boolean> {
  if (!user) return false;
  return hasRole(user, 'ROLE_ADMIN', organizationId);
}

/**
 * Check if user has ROLE_MODERATOR in the given organization context
 *
 * @param user - User to check
 * @param organizationId - Organization context (null = platform-wide, undefined = any)
 * @returns true if user is moderator in the given context
 */
export async function requireModerator(
  user: UserWithRoles | null,
  organizationId?: string | null
): Promise<boolean> {
  if (!user) return false;
  return hasRole(user, 'ROLE_MODERATOR', organizationId);
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit tests/unit/api-utils.spec.ts`

Expected: PASS - all tests pass

**Step 5: Commit API utils**

```bash
git add src/lib/api-utils.ts tests/unit/api-utils.spec.ts
git commit -m "feat(api): add requireAdmin and requireModerator helpers with org context

- Add requireAdmin() helper for context-aware admin checks
- Add requireModerator() helper for context-aware moderator checks
- Support platform-wide (null) and org-scoped checks

Refs #183"
```

---

### Task 2.2: Update Organization API Routes

**Files:**
- Modify: `src/app/api/admin/organizations/route.ts`
- Modify: `src/app/api/admin/organizations/[id]/route.ts`

**Step 1: Update GET /api/admin/organizations to require platform admin**

In `src/app/api/admin/organizations/route.ts`:

```typescript
import { requireAdmin } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  // Only platform admins can list all organizations
  const isPlatformAdmin = await requireAdmin(user, null);
  if (!isPlatformAdmin) {
    return NextResponse.json(
      {
        error: {
          type: 'AUTHORIZATION_ERROR',
          message: 'Requires platform admin access',
        },
      },
      { status: 403 }
    );
  }

  // ... rest of implementation
}
```

**Step 2: Update POST /api/admin/organizations to require platform admin**

```typescript
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  // Only platform admins can create organizations
  const isPlatformAdmin = await requireAdmin(user, null);
  if (!isPlatformAdmin) {
    return NextResponse.json(
      {
        error: {
          type: 'AUTHORIZATION_ERROR',
          message: 'Requires platform admin access',
        },
      },
      { status: 403 }
    );
  }

  // ... rest of implementation
}
```

**Step 3: Update PATCH /api/admin/organizations/[id] for org-scoped admin**

In `src/app/api/admin/organizations/[id]/route.ts`:

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  const orgId = params.id;

  // Check if user is admin of this organization (or platform admin)
  const canManage = await isGranted(user, 'organization.manage', {
    organizationId: orgId,
    subject: { id: orgId }, // Will be full org object after fetch
  });

  if (!canManage) {
    return NextResponse.json(
      {
        error: {
          type: 'AUTHORIZATION_ERROR',
          message: 'Not authorized to manage this organization',
        },
      },
      { status: 403 }
    );
  }

  // ... rest of implementation
}
```

**Step 4: Update DELETE /api/admin/organizations/[id] to require ROLE_OWNER**

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  const orgId = params.id;

  // Fetch organization for voter check
  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!organization) {
    return NextResponse.json(
      { error: { type: 'NOT_FOUND', message: 'Organization not found' } },
      { status: 404 }
    );
  }

  // Only org owner can delete (checked by OrganizationVoter)
  const canDelete = await isGranted(user, 'organization.delete', {
    organizationId: orgId,
    subject: organization,
  });

  if (!canDelete) {
    return NextResponse.json(
      {
        error: {
          type: 'AUTHORIZATION_ERROR',
          message: 'Only organization owner can delete',
        },
      },
      { status: 403 }
    );
  }

  // ... rest of implementation
}
```

**Step 5: Run tests**

Run: `npm run test:unit tests/unit/admin-organizations-api.spec.ts`

Expected: Tests need updating for new auth checks

**Step 6: Commit organization route updates**

```bash
git add src/app/api/admin/organizations/
git commit -m "feat(api): update organization routes with context-aware auth

- GET/POST /api/admin/organizations requires platform admin (org=null)
- PATCH /api/admin/organizations/[id] uses org-scoped admin check
- DELETE requires ROLE_OWNER via OrganizationVoter
- Use isGranted with organization context

Refs #183"
```

---

### Task 2.3: Update User Role Assignment API

**Files:**
- Modify: `src/app/api/admin/users/[id]/roles/route.ts`
- Test: `tests/unit/admin-user-roles-api.spec.ts`

**Step 1: Update POST endpoint to accept organizationId**

In `src/app/api/admin/users/[id]/roles/route.ts`:

```typescript
const bodySchema = z.object({
  roleName: z.string().regex(/^ROLE_[A-Z][A-Z0-9_]+$/),
  organizationId: z.string().nullable().optional(), // Add this field
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const validatedBody = bodySchema.safeParse(body);

  if (!validatedBody.success) {
    return NextResponse.json(
      { error: { type: 'VALIDATION_ERROR', message: validatedBody.error } },
      { status: 400 }
    );
  }

  const { roleName, organizationId } = validatedBody.data;
  const targetUserId = params.id;

  // Authorization: Only platform admin can assign platform-wide roles
  if (organizationId === null || organizationId === undefined) {
    const isPlatformAdmin = await requireAdmin(user, null);
    if (!isPlatformAdmin) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Only platform admins can assign platform-wide roles',
          },
        },
        { status: 403 }
      );
    }
  } else {
    // Org-scoped assignment: must be admin of that org
    const isOrgAdmin = await requireAdmin(user, organizationId);
    if (!isOrgAdmin) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Not authorized to assign roles in this organization',
          },
        },
        { status: 403 }
      );
    }
  }

  // Find role by name
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    return NextResponse.json(
      { error: { type: 'NOT_FOUND', message: 'Role not found' } },
      { status: 404 }
    );
  }

  // Create role assignment with context
  const assignment = await prisma.userRole.create({
    data: {
      userId: targetUserId,
      roleId: role.id,
      organizationId: organizationId ?? null,
    },
    include: {
      role: true,
      organization: true,
    },
  });

  return NextResponse.json(
    {
      assignment: {
        id: assignment.id,
        userId: assignment.userId,
        roleName: assignment.role.name,
        organizationId: assignment.organizationId,
        organizationName: assignment.organization?.name ?? null,
        createdAt: assignment.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
```

**Step 2: Update DELETE endpoint for context-aware removal**

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const roleName = searchParams.get('roleName');
  const organizationId = searchParams.get('organizationId'); // Can be 'null' string

  if (!roleName) {
    return NextResponse.json(
      { error: { type: 'VALIDATION_ERROR', message: 'roleName required' } },
      { status: 400 }
    );
  }

  const targetUserId = params.id;

  // Parse organizationId (handle 'null' string)
  const parsedOrgId =
    organizationId === 'null' || organizationId === null
      ? null
      : organizationId;

  // Authorization check (same as POST)
  if (parsedOrgId === null) {
    const isPlatformAdmin = await requireAdmin(user, null);
    if (!isPlatformAdmin) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Only platform admins can remove platform-wide roles',
          },
        },
        { status: 403 }
      );
    }
  } else {
    const isOrgAdmin = await requireAdmin(user, parsedOrgId);
    if (!isOrgAdmin) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Not authorized to remove roles in this organization',
          },
        },
        { status: 403 }
      );
    }
  }

  // Find and delete the specific role assignment
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    return NextResponse.json(
      { error: { type: 'NOT_FOUND', message: 'Role not found' } },
      { status: 404 }
    );
  }

  await prisma.userRole.deleteMany({
    where: {
      userId: targetUserId,
      roleId: role.id,
      organizationId: parsedOrgId,
    },
  });

  return NextResponse.json({ success: true });
}
```

**Step 3: Run tests**

Run: `npm run test:unit tests/unit/admin-user-roles-api.spec.ts`

Expected: Tests need updating for organizationId field

**Step 4: Commit user role API updates**

```bash
git add src/app/api/admin/users/[id]/roles/route.ts
git commit -m "feat(api): add organizationId to user role assignment API

- Accept organizationId in POST body (nullable for platform-wide)
- Platform admins can assign platform-wide roles (org=null)
- Org admins can assign roles in their org only
- DELETE accepts organizationId query param for context-aware removal

Refs #183"
```

---

## Phase 3: UI Components

### Task 3.1: Update Role Selector Component

**Files:**
- Modify: `src/components/admin/role-selector.tsx`

**Step 1: Add organization context to role selector**

Update component to accept organizationId prop:

```typescript
interface RoleSelectorProps {
  userId: string;
  currentRoles: string[];
  organizationId?: string | null; // Add this
  onRoleChange: (roleName: string, action: 'add' | 'remove') => void;
}

export function RoleSelector({
  userId,
  currentRoles,
  organizationId,
  onRoleChange,
}: RoleSelectorProps) {
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);

  useEffect(() => {
    // Fetch available roles from API
    fetch('/api/admin/roles')
      .then((res) => res.json())
      .then((data) => setAvailableRoles(data.roles));
  }, []);

  const handleAssignRole = async (roleName: string) => {
    const response = await fetch(`/api/admin/users/${userId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleName,
        organizationId, // Pass context
      }),
    });

    if (response.ok) {
      onRoleChange(roleName, 'add');
    }
  };

  const handleRemoveRole = async (roleName: string) => {
    const orgParam =
      organizationId === null
        ? 'null'
        : organizationId
        ? organizationId
        : undefined;
    const params = new URLSearchParams({
      roleName,
      ...(orgParam && { organizationId: orgParam }),
    });

    const response = await fetch(
      `/api/admin/users/${userId}/roles?${params}`,
      {
        method: 'DELETE',
      }
    );

    if (response.ok) {
      onRoleChange(roleName, 'remove');
    }
  };

  return (
    <div className="role-selector">
      <h3>
        Roles
        {organizationId === null && ' (Platform-Wide)'}
        {organizationId && ' (Organization-Scoped)'}
      </h3>
      {availableRoles.map((role) => (
        <div key={role.id}>
          <label>
            <input
              type="checkbox"
              checked={currentRoles.includes(role.name)}
              onChange={(e) =>
                e.target.checked
                  ? handleAssignRole(role.name)
                  : handleRemoveRole(role.name)
              }
              disabled={role.isSystem && currentRoles.includes(role.name)}
            />
            {role.name}
            {role.description && <span> - {role.description}</span>}
          </label>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit role selector updates**

```bash
git add src/components/admin/role-selector.tsx
git commit -m "feat(ui): add organization context to role selector

- Accept organizationId prop for context-aware role assignment
- Pass organizationId to POST/DELETE endpoints
- Show context indicator (Platform-Wide vs Organization-Scoped)
- Disable removing system roles

Refs #183"
```

---

### Task 3.2: Update Navigation Authorization

**Files:**
- Modify: `src/components/layout/navbar.tsx`

**Step 1: Replace hardcoded role checks with isGranted**

Find sections like this:

```typescript
// BEFORE (hardcoded)
{session.user.role === 'ADMIN' && (
  <Link href="/admin">Admin Panel</Link>
)}
```

Replace with context-aware check:

```typescript
// AFTER (dynamic)
{session.user.userRoles?.some(
  (ur) => ur.role.name === 'ROLE_ADMIN'
) && (
  <Link href="/admin">Admin Panel</Link>
)}
```

**Step 2: For organization-specific links, add context**

```typescript
// Organization settings link (requires org admin)
{currentOrganization && (
  <OrgAdminLink organizationId={currentOrganization.id}>
    <Link href={`/organizations/${currentOrganization.id}/settings`}>
      Organization Settings
    </Link>
  </OrgAdminLink>
)}
```

Create helper component:

```typescript
function OrgAdminLink({
  organizationId,
  children,
}: {
  organizationId: string;
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  if (!session?.user) return null;

  // Check if user is admin of this org
  const isOrgAdmin = session.user.userRoles?.some(
    (ur) =>
      (ur.role.name === 'ROLE_ADMIN' || ur.role.name === 'ROLE_OWNER') &&
      (ur.organizationId === organizationId || ur.organizationId === null)
  );

  return isOrgAdmin ? <>{children}</> : null;
}
```

**Step 3: Commit navigation updates**

```bash
git add src/components/layout/navbar.tsx
git commit -m "feat(ui): update navbar with context-aware role checks

- Replace hardcoded role checks with userRoles inspection
- Add OrgAdminLink component for org-scoped menu items
- Support platform-wide admins (organizationId=null)

Refs #183"
```

---

## Phase 4: Testing & Documentation

### Task 4.1: Update Integration Tests

**Files:**
- Modify: `tests/integration/organizations-api.spec.ts`

**Step 1: Add test for platform admin creating org**

```typescript
describe('POST /api/admin/organizations', () => {
  it('allows platform admin to create organization', async () => {
    // Create platform admin (org=null)
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: 'hashed',
        username: 'admin',
        userRoles: {
          create: {
            role: { connect: { name: 'ROLE_ADMIN' } },
            organizationId: null, // Platform-wide
          },
        },
      },
    });

    const token = generateToken(adminUser);

    const response = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'New Org',
        slug: 'new-org',
      }),
    });

    expect(response.status).toBe(201);
  });

  it('denies org-scoped admin from creating organization', async () => {
    // Create org-scoped admin
    const orgAdminUser = await prisma.user.create({
      data: {
        email: 'orgadmin@example.com',
        password: 'hashed',
        username: 'orgadmin',
        userRoles: {
          create: {
            role: { connect: { name: 'ROLE_ADMIN' } },
            organizationId: org.id, // Scoped to specific org
          },
        },
      },
    });

    const token = generateToken(orgAdminUser);

    const response = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Another Org',
        slug: 'another-org',
      }),
    });

    expect(response.status).toBe(403);
  });
});
```

**Step 2: Add test for org owner deleting org**

```typescript
describe('DELETE /api/admin/organizations/[id]', () => {
  it('allows org owner to delete organization', async () => {
    const ownerUser = await prisma.user.create({
      data: {
        email: 'owner@example.com',
        password: 'hashed',
        username: 'owner',
        userRoles: {
          create: {
            role: { connect: { name: 'ROLE_OWNER' } },
            organizationId: org.id,
          },
        },
      },
    });

    const token = generateToken(ownerUser);

    const response = await fetch(`/api/admin/organizations/${org.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
  });

  it('denies org admin (non-owner) from deleting', async () => {
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: 'hashed',
        username: 'admin',
        userRoles: {
          create: {
            role: { connect: { name: 'ROLE_ADMIN' } }, // Not OWNER
            organizationId: org.id,
          },
        },
      },
    });

    const token = generateToken(adminUser);

    const response = await fetch(`/api/admin/organizations/${org.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(403);
  });
});
```

**Step 3: Run integration tests**

Run: `npm run test:e2e`

Expected: All integration tests pass

**Step 4: Commit integration tests**

```bash
git add tests/integration/
git commit -m "test(integration): add context-aware organization API tests

- Test platform admin can create organizations
- Test org-scoped admin cannot create organizations
- Test org owner can delete organization
- Test org admin (non-owner) cannot delete

Refs #183"
```

---

### Task 4.2: Update API Documentation

**Files:**
- Modify: `docs/API_REFERENCE.md`

**Step 1: Document organizationId context parameter**

Add section:

```markdown
## Organization Context

Many API endpoints now accept an `organizationId` parameter to scope operations to a specific organization.

### Context Values

- `null` - Platform-wide (super admin context)
- `"org-id"` - Scoped to specific organization
- Omitted - Any context (not recommended for production use)

### Role Assignment Example

```http
POST /api/admin/users/{userId}/roles
Content-Type: application/json

{
  "roleName": "ROLE_ADMIN",
  "organizationId": "org-123"
}
```

Response:

```json
{
  "assignment": {
    "id": "assignment-id",
    "userId": "user-id",
    "roleName": "ROLE_ADMIN",
    "organizationId": "org-123",
    "organizationName": "ACME Corp",
    "createdAt": "2026-01-04T12:00:00Z"
  }
}
```

### Platform-Wide Role Assignment

```http
POST /api/admin/users/{userId}/roles
Content-Type: application/json

{
  "roleName": "ROLE_ADMIN",
  "organizationId": null
}
```

**Requires:** Platform admin access (user must have `ROLE_ADMIN` with `organizationId=null`)
```

**Step 2: Update role hierarchy documentation**

```markdown
## Role Hierarchy

Roles inherit permissions from parent roles:

```
ROLE_OWNER (organization-level)
  └─ ROLE_ADMIN
      └─ ROLE_MODERATOR
          └─ ROLE_USER
```

### System Roles

- `ROLE_USER` - Base role, all authenticated users
- `ROLE_MODERATOR` - Content moderation
- `ROLE_ADMIN` - Administrative access
- `ROLE_OWNER` - Organization owner (highest level)

### Custom Roles

Custom roles can be created via:

```http
POST /api/admin/roles
Content-Type: application/json

{
  "name": "ROLE_EDITOR",
  "description": "Content editor",
  "parentId": "role-user-id"
}
```

**Requires:** Platform admin access
```

**Step 3: Commit documentation updates**

```bash
git add docs/API_REFERENCE.md
git commit -m "docs(api): document organizationId context and role hierarchy

- Add organization context section with examples
- Document role hierarchy and inheritance
- Add examples for platform-wide vs org-scoped assignments
- Document custom role creation

Refs #183"
```

---

### Task 4.3: Update OpenAPI Specification

**Files:**
- Modify: `scripts/generate-openapi.ts`

**Step 1: Add organizationId to role assignment schema**

In the schema definitions:

```typescript
const UserRoleAssignmentSchema = registry.register(
  'UserRoleAssignment',
  z.object({
    roleName: z
      .string()
      .regex(/^ROLE_[A-Z][A-Z0-9_]+$/)
      .openapi({
        description: 'Role name to assign',
        example: 'ROLE_ADMIN',
      }),
    organizationId: z
      .string()
      .nullable()
      .optional()
      .openapi({
        description:
          'Organization context (null = platform-wide, omit = any context)',
        example: 'org-123',
      }),
  })
);
```

**Step 2: Document context in path operations**

```typescript
registry.registerPath({
  method: 'post',
  path: '/api/admin/users/{id}/roles',
  summary: 'Assign role to user',
  description: `Assign a role to a user with optional organization context.

    - Platform admins can assign platform-wide roles (organizationId=null)
    - Org admins can assign org-scoped roles (organizationId="org-id")`,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'User ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UserRoleAssignmentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Role assigned successfully',
      content: {
        'application/json': {
          schema: RoleAssignmentResponseSchema,
        },
      },
    },
    401: UnauthorizedSchema,
    403: ForbiddenSchema,
    404: NotFoundSchema,
  },
});
```

**Step 3: Generate updated OpenAPI files**

Run: `npm run docs:openapi`

Expected: `docs/public/openapi.json` and `docs/public/openapi.yaml` updated

**Step 4: Commit OpenAPI updates**

```bash
git add scripts/generate-openapi.ts docs/public/openapi.*
git commit -m "docs(openapi): add organizationId to role assignment spec

- Add organizationId field to UserRoleAssignment schema
- Document platform-wide vs org-scoped assignments
- Regenerate OpenAPI JSON and YAML files

Refs #183"
```

---

## Final Steps

### Task 5.1: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm run test`

Expected: All tests pass (unit + integration + e2e)

**Step 2: If any failures, fix them**

For each failure:
1. Identify the broken test
2. Update test to match new context-aware API
3. Run test again to verify fix
4. Commit fix

**Step 3: Verify type checking**

Run: `npx tsc --noEmit`

Expected: No type errors

---

### Task 5.2: Create Migration Guide

**Files:**
- Create: `docs/guides/unified-role-migration.md`

**Content:**

```markdown
# Unified Role Architecture Migration Guide

This guide helps you migrate from the old dual role system to the unified context-aware RBAC model.

## Breaking Changes

### 1. User.organizationRole Removed

**Before:**
```typescript
const user = await prisma.user.findUnique({
  where: { id },
  select: { organizationRole: true },
});

if (user.organizationRole === 'ADMIN') {
  // ...
}
```

**After:**
```typescript
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    userRoles: {
      include: { role: true },
    },
  },
});

const isOrgAdmin = await hasRole(user, 'ROLE_ADMIN', organizationId);
```

### 2. OrganizationRole Enum Removed

**Before:**
```typescript
import { OrganizationRole } from '@prisma/client';
```

**After:**
```typescript
// Use role names directly
const ROLE_OWNER = 'ROLE_OWNER';
const ROLE_ADMIN = 'ROLE_ADMIN';
```

### 3. Role Assignment Now Requires Context

**Before:**
```typescript
await prisma.userRole.create({
  data: {
    userId: user.id,
    roleId: role.id,
  },
});
```

**After:**
```typescript
await prisma.userRole.create({
  data: {
    userId: user.id,
    roleId: role.id,
    organizationId: org.id, // Or null for platform-wide
  },
});
```

## Common Patterns

### Platform-Wide Super Admin

```typescript
// Create super admin
await prisma.userRole.create({
  data: {
    userId: user.id,
    roleId: adminRole.id,
    organizationId: null, // Platform-wide
  },
});

// Check super admin
const isSuperAdmin = await hasRole(user, 'ROLE_ADMIN', null);
```

### Organization Owner

```typescript
// Assign owner role
await prisma.userRole.create({
  data: {
    userId: user.id,
    roleId: ownerRole.id,
    organizationId: org.id,
  },
});

// Check owner
const isOwner = await isGranted(user, 'organization.delete', {
  organizationId: org.id,
  subject: org,
});
```

### Multi-Organization User

```typescript
// User is admin in Org A, member in Org B
await prisma.userRole.createMany({
  data: [
    {
      userId: user.id,
      roleId: adminRole.id,
      organizationId: orgA.id,
    },
    {
      userId: user.id,
      roleId: userRole.id,
      organizationId: orgB.id,
    },
  ],
});

// Context-aware checks
await hasRole(user, 'ROLE_ADMIN', orgA.id); // true
await hasRole(user, 'ROLE_ADMIN', orgB.id); // false
```
```

**Step 1: Commit migration guide**

```bash
git add docs/guides/unified-role-migration.md
git commit -m "docs: add migration guide for unified role architecture

- Document breaking changes
- Show before/after code examples
- Provide common patterns for super admin, owner, multi-org

Refs #183"
```

---

### Task 5.3: Final Integration Check

**Step 1: Reset database and re-seed**

Run:
```bash
npx prisma migrate reset --force
npx prisma db seed
```

Expected: Database recreated with new schema and roles

**Step 2: Manual verification checklist**

1. ✅ Platform admin can create organizations
2. ✅ Org admin can manage their organization
3. ✅ Org admin cannot manage other organizations
4. ✅ Org owner can delete their organization
5. ✅ Org admin cannot delete organization
6. ✅ Super admin works across all organizations
7. ✅ Role assignments include organizationId context

**Step 3: Create final commit**

```bash
git add .
git commit -m "feat: unified dynamic role architecture with tenant scoping

Complete implementation of context-aware RBAC system:

Schema Changes:
- Add organizationId to UserRole (nullable for platform-wide)
- Remove organizationRole from User
- Remove OrganizationRole enum
- Add ROLE_OWNER system role

Security Core:
- Update isGranted() with context parameter
- Context-aware hasRole() with org filtering
- Update voters to accept organization context
- Support platform-wide (org=null) and org-scoped roles

API Updates:
- requireAdmin/requireModerator helpers with org context
- Organization routes use context-aware authorization
- User role assignment accepts organizationId
- OpenAPI spec updated with context documentation

UI Updates:
- Role selector with organization context
- Navigation uses dynamic role checks
- Support platform-wide vs org-scoped display

Testing:
- Unit tests for context-aware role checking
- Integration tests for multi-tenant scenarios
- E2E tests for authorization flows

Documentation:
- API reference updated with context examples
- Migration guide for breaking changes
- Role hierarchy documentation

Closes #183"
```

---

## Execution Options

Plan complete and saved to `docs/plans/2026-01-04-unified-role-architecture-impl.md`.

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
