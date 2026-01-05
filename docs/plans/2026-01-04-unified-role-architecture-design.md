# Unified Dynamic Role Architecture with Tenant Scoping - Design Document

**Date:** 2026-01-04
**Status:** Approved
**Author:** Architecture Spike #183

## Executive Summary

This design unifies the current dual role system (platform roles + organization enum) into a single context-aware RBAC model following Symfony security patterns. The key innovation: every role assignment includes organizational context, enabling both platform-wide super admins and org-scoped role assignments through a single table.

**Core Principle:** A role assignment is meaningless without context.

## Problem Statement

The current RBAC implementation has architectural tension:

| Goal | Reality |
|------|---------|
| Dynamic roles in DB | Code assumes 3 fixed roles (`ROLE_USER`, `ROLE_MODERATOR`, `ROLE_ADMIN`) |
| Platform roles | Tenant (organization) model exists but roles aren't scoped |
| Org roles | Hardcoded enum (`OWNER`/`ADMIN`/`MEMBER`), not extensible |

### Current Limitations

1. **Hardcoded Role Assumptions**
   - `ROLES` constant in `security/index.ts` and `security/client.ts`
   - `getHighestRole()` assumes exactly 3 roles in specific hierarchy
   - UI components assume 3 roles

2. **Platform Roles Are Not Tenant-Scoped**
   - `UserRole` table has no `organizationId`
   - A `ROLE_ADMIN` has admin access across ALL organizations
   - No way to have "Admin of Org A but User of Org B"

3. **Two Disconnected Role Systems**
   - Platform: `Role`/`UserRole` tables (dynamic schema, static code)
   - Organization: `OrganizationRole` enum (hardcoded)
   - No unified permission model

## Design Decisions

### Decision 1: Hybrid Context-Aware Model ✅

**Chosen:** Platform roles exist but are checked WITH organization context

- `ROLE_ADMIN` + `org=null` → platform-wide super admin
- `ROLE_ADMIN` + `org=123` → admin of org 123 only
- Most flexible, clean migration path
- Matches SaaS platforms (GitHub, Slack, etc.)

### Decision 2: Roles + Voters (Symfony Pattern) ✅

**Chosen:** Hybrid approach using both roles and voters

- Roles for broad access levels (fast, simple checks)
- Voters for complex contextual permissions
- Matches existing Symfony-style implementation

### Decision 3: Clean Break Migration ✅

**Chosen:** One big migration, update schema + all code at once

- No users in production yet → can wipe database
- Cleanest path to target architecture
- No backward compatibility burden

## Architecture

### High-Level Overview

**Three-Layer Model:**

1. **Roles** - Abstract privilege levels stored in database
   - Example: `ROLE_ADMIN`, `ROLE_EDITOR`, `ROLE_VIEWER`
   - Hierarchical (parent-child relationships)
   - Can be system roles (protected) or custom roles

2. **Role Assignments** - User + Role + Context
   - `UserRole(userId, roleId, organizationId)`
   - `organizationId = null` → platform-wide (super admin)
   - `organizationId = X` → scoped to that organization
   - One user can have different roles in different organizations

3. **Voters** - Contextual permission logic
   - Check complex conditions beyond role hierarchy
   - Example: "Can user edit THIS document in THIS org?"
   - Receive full context: user, attribute, subject, organization

**Authorization Flow:**
```typescript
isGranted(user, 'ROLE_ADMIN', { organizationId: '123' })
→ Check: Does user have ROLE_ADMIN assignment for org 123?
→ OR: Does user have ROLE_ADMIN assignment with org = null? (super admin)
```

## Schema Design

### Updated Prisma Schema

```prisma
// Unified role model - no longer platform-specific
model Role {
  id          String   @id @default(cuid())
  name        String   @unique // "ROLE_ADMIN", "ROLE_EDITOR", "ROLE_VIEWER"
  description String?
  parentId    String?  @map("parent_id")
  isSystem    Boolean  @default(false) @map("is_system") // Protect core roles
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  parent       Role?      @relation("RoleHierarchy", fields: [parentId], references: [id])
  children     Role[]     @relation("RoleHierarchy")
  userRoles    UserRole[]

  @@map("roles")
}

// Context-aware role assignment - KEY CHANGE
model UserRole {
  id             String    @id @default(cuid())
  userId         String    @map("user_id")
  roleId         String    @map("role_id")
  organizationId String?   @map("organization_id") // NULL = platform-wide
  createdAt      DateTime  @default(now()) @map("created_at")

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  role         Role          @relation(fields: [roleId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // One role assignment per user/role/org combination
  @@unique([userId, roleId, organizationId])
  @@index([userId])
  @@index([roleId])
  @@index([organizationId])
  @@map("user_roles")
}

// User model - REMOVE organizationRole field
model User {
  id                String    @id @default(cuid())
  // ... all existing fields ...

  // REMOVED: organizationRole OrganizationRole
  // REMOVED: organizationId (moved to UserRole context)

  userRoles UserRole[] // Now handles ALL role assignments

  @@map("users")
}

// Organization model - ADD reverse relation
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  userRoles UserRole[] // Context-scoped roles
  invites   OrganizationInvite[]

  @@map("organizations")
}

// REMOVE: OrganizationRole enum (replaced by Role + UserRole)
```

**Key Points:**
- `UserRole.organizationId = null` → platform-wide role (super admin)
- `UserRole.organizationId = '123'` → role scoped to org 123
- Single table handles both use cases
- Unique constraint prevents duplicate assignments

## Authorization API

### Updated `isGranted()` Signature

```typescript
// New signature with optional context
export async function isGranted(
  user: UserWithRoles | null,
  attribute: string,
  context?: {
    organizationId?: string | null;
    subject?: unknown; // For voter checks
  }
): Promise<boolean>
```

### Authorization Examples

```typescript
// 1. Platform-wide admin check
await isGranted(user, 'ROLE_ADMIN', { organizationId: null })
// → Checks: user has ROLE_ADMIN with org = null

// 2. Org-specific admin check
await isGranted(user, 'ROLE_ADMIN', { organizationId: '123' })
// → Checks: user has ROLE_ADMIN for org 123 OR org = null (super admin)

// 3. No context = check ANY assignment
await isGranted(user, 'ROLE_ADMIN')
// → Checks: user has ROLE_ADMIN in ANY context

// 4. Voter-based check with context
await isGranted(user, 'organization.manage', {
  organizationId: '123',
  subject: organization
})
// → Delegates to OrganizationVoter with full context
```

### Role Resolution Logic

```typescript
async function hasRoleInContext(
  user: UserWithRoles,
  roleName: string,
  organizationId?: string | null
): Promise<boolean> {
  // Get user's role assignments
  const assignments = user.userRoles;

  // Filter by organization context
  const relevantAssignments = assignments.filter(ur => {
    if (organizationId === undefined) {
      // No context specified - any assignment counts
      return true;
    }
    // Platform-wide roles (null) work everywhere
    if (ur.organizationId === null) return true;
    // Org-specific roles must match
    return ur.organizationId === organizationId;
  });

  // Check role hierarchy
  const roleNames = relevantAssignments.map(ur => ur.role.name);
  const allRoles = await resolveHierarchy(roleNames);
  return allRoles.has(roleName);
}
```

**Key Behavior:**
- Super admins (`org = null`) pass ALL org-scoped checks
- Org-scoped roles only work in their organization
- Voters receive full context for complex decisions

## Voter Adaptations

### Updated Voter Interface

```typescript
export interface Voter {
  /**
   * Check if this voter handles the given attribute
   */
  supports(attribute: string, subject?: unknown): Promise<boolean>;

  /**
   * Vote on the authorization decision
   * NOW RECEIVES: organizationId context
   */
  vote(
    user: UserWithRoles,
    attribute: string,
    subject: unknown,
    context?: { organizationId?: string | null }
  ): Promise<VoteResult>;
}
```

### Example: Updated OrganizationVoter

```typescript
class OrganizationVoter implements Voter {
  async supports(attribute: string, subject?: unknown): Promise<boolean> {
    return attribute.startsWith('organization.') &&
           subject instanceof Organization;
  }

  async vote(
    user: UserWithRoles,
    attribute: string,
    subject: unknown,
    context?: { organizationId?: string | null }
  ): Promise<VoteResult> {
    const org = subject as Organization;

    // Check if user has ADMIN role in THIS organization
    const hasOrgAdmin = await hasRoleInContext(
      user,
      'ROLE_ADMIN',
      org.id // Context from subject
    );

    if (hasOrgAdmin) {
      return VoteResult.GRANTED;
    }

    // Check for OWNER role
    const hasOwner = await hasRoleInContext(
      user,
      'ROLE_OWNER',
      org.id
    );

    if (attribute === 'organization.delete') {
      // Only owners can delete
      return hasOwner ? VoteResult.GRANTED : VoteResult.DENIED;
    }

    if (attribute === 'organization.manage') {
      // Admins and owners can manage
      return hasOrgAdmin || hasOwner ? VoteResult.GRANTED : VoteResult.DENIED;
    }

    return VoteResult.ABSTAIN;
  }
}
```

### Pattern for Future Resource Voters

```typescript
// Example: DocumentVoter (future use case)
class DocumentVoter implements Voter {
  async vote(user, attribute, subject, context) {
    const doc = subject as Document;

    // 1. Check platform-wide admin (super admin)
    if (await hasRoleInContext(user, 'ROLE_ADMIN', null)) {
      return VoteResult.GRANTED;
    }

    // 2. Check org-scoped admin
    if (await hasRoleInContext(user, 'ROLE_ADMIN', doc.organizationId)) {
      return VoteResult.GRANTED;
    }

    // 3. Check document-specific permissions
    if (doc.authorId === user.id) {
      return VoteResult.GRANTED; // Author can always edit
    }

    return VoteResult.DENIED;
  }
}
```

**Voter Pattern:**
1. Always check platform-wide roles first (super admin)
2. Then check org-scoped roles
3. Then check resource-specific logic

## Migration Strategy

### Database Reset (No Users Yet)

```bash
# Drop existing database
npx prisma migrate reset --force

# Apply new schema
npx prisma migrate dev --name unified-role-architecture

# Seed with new role structure
npx prisma db seed
```

### Seed Data - New Role Structure

```typescript
// prisma/seed.ts
async function seedRoles() {
  // System roles with hierarchy
  const roleUser = await prisma.role.create({
    data: {
      name: 'ROLE_USER',
      description: 'Basic platform access',
      isSystem: true,
    },
  });

  const roleModerator = await prisma.role.create({
    data: {
      name: 'ROLE_MODERATOR',
      description: 'Content moderation capabilities',
      isSystem: true,
      parentId: roleUser.id, // Inherits from USER
    },
  });

  const roleAdmin = await prisma.role.create({
    data: {
      name: 'ROLE_ADMIN',
      description: 'Full administrative access',
      isSystem: true,
      parentId: roleModerator.id, // Inherits from MODERATOR
    },
  });

  // Organization-specific roles
  const roleOwner = await prisma.role.create({
    data: {
      name: 'ROLE_OWNER',
      description: 'Organization owner',
      isSystem: true,
      parentId: roleAdmin.id, // Owner > Admin > Moderator > User
    },
  });

  const roleEditor = await prisma.role.create({
    data: {
      name: 'ROLE_EDITOR',
      description: 'Content editor',
      isSystem: false, // Customizable
      parentId: roleUser.id,
    },
  });
}
```

### Breaking Changes to Fix

```typescript
// BEFORE (hardcoded assumptions)
export const ROLES = {
  ADMIN: 'ROLE_ADMIN',
  MODERATOR: 'ROLE_MODERATOR',
  USER: 'ROLE_USER',
} as const;

function getHighestRole(user) {
  // Hardcoded hierarchy check
  if (roleNames.includes(ROLES.ADMIN)) return ROLES.ADMIN;
  if (roleNames.includes(ROLES.MODERATOR)) return ROLES.MODERATOR;
  return ROLES.USER;
}

// AFTER (dynamic from database)
// Remove ROLES constant entirely
// Use role hierarchy from database

async function getHighestRole(user, orgId?) {
  const roles = await getUserRolesInContext(user, orgId);
  return findHighestInHierarchy(roles); // Uses DB hierarchy
}
```

### Files to Update

- ❌ Remove: `src/lib/security/client.ts` ROLES constant
- ✅ Update: `src/lib/security/index.ts` - remove hardcoded checks
- ✅ Update: All API routes - add `organizationId` context to `isGranted()`
- ✅ Update: UI components - fetch roles dynamically from API
- ✅ Update: JWT validation - accept any valid role from DB

## Usage Recipes

### Recipe 1: Multi-Tenant Admin

```typescript
// User is admin of Org A, member of Org B

// Assign org-scoped admin role
await prisma.userRole.create({
  data: {
    userId: user.id,
    roleId: roleAdmin.id,
    organizationId: orgA.id, // Admin only in Org A
  },
});

// Assign member role in Org B
await prisma.userRole.create({
  data: {
    userId: user.id,
    roleId: roleUser.id,
    organizationId: orgB.id, // User in Org B
  },
});

// Authorization checks
await isGranted(user, 'ROLE_ADMIN', { organizationId: orgA.id }) // ✅ true
await isGranted(user, 'ROLE_ADMIN', { organizationId: orgB.id }) // ❌ false
```

### Recipe 2: Platform Super Admin

```typescript
// Assign platform-wide admin (org = null)
await prisma.userRole.create({
  data: {
    userId: superAdminUser.id,
    roleId: roleAdmin.id,
    organizationId: null, // Platform-wide
  },
});

// Super admin passes ALL org checks
await isGranted(superAdmin, 'ROLE_ADMIN', { organizationId: 'any-org' }) // ✅ true
await isGranted(superAdmin, 'ROLE_ADMIN', { organizationId: null }) // ✅ true
```

### Recipe 3: Organization Owner

```typescript
// First user in org becomes owner
const owner = await prisma.userRole.create({
  data: {
    userId: user.id,
    roleId: roleOwner.id, // ROLE_OWNER > ROLE_ADMIN via hierarchy
    organizationId: org.id,
  },
});

// Owner can delete org (voter checks ROLE_OWNER specifically)
await isGranted(user, 'organization.delete', {
  organizationId: org.id,
  subject: org
}) // ✅ true (OrganizationVoter grants)
```

### Recipe 4: Custom Role for Specific Org

```typescript
// Create custom role (e.g., "Content Manager")
const roleContentManager = await prisma.role.create({
  data: {
    name: 'ROLE_CONTENT_MANAGER',
    description: 'Can manage blog posts and pages',
    isSystem: false, // Not a system role
    parentId: roleUser.id, // Inherits basic user permissions
  },
});

// Assign to user in specific org
await prisma.userRole.create({
  data: {
    userId: user.id,
    roleId: roleContentManager.id,
    organizationId: org.id,
  },
});

// Create voter for content permissions
class ContentVoter implements Voter {
  async vote(user, attribute, subject, context) {
    if (attribute === 'content.manage') {
      return await hasRoleInContext(user, 'ROLE_CONTENT_MANAGER', context.organizationId)
        ? VoteResult.GRANTED
        : VoteResult.ABSTAIN;
    }
  }
}
```

### Recipe 5: API Route Protection

```typescript
// Before: Hardcoded role check
if (session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// After: Context-aware check
const orgId = params.organizationId; // From URL
const canManage = await isGranted(
  session.user,
  'ROLE_ADMIN',
  { organizationId: orgId }
);

if (!canManage) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Recipe 6: UI Role Display

```typescript
// Fetch user's roles for current org
const userRoles = await prisma.userRole.findMany({
  where: {
    userId: user.id,
    organizationId: currentOrg.id,
  },
  include: { role: true },
});

// Display: "Admin of ACME Corp"
const highestRole = findHighestInHierarchy(userRoles);
```

## Testing Strategy

### Unit Tests - Role Hierarchy

```typescript
describe('hasRoleInContext', () => {
  it('resolves role hierarchy correctly', async () => {
    // Given: User has ROLE_ADMIN in Org A
    // Then: Should have ROLE_MODERATOR and ROLE_USER via hierarchy

    expect(await hasRoleInContext(user, 'ROLE_ADMIN', orgA.id)).toBe(true);
    expect(await hasRoleInContext(user, 'ROLE_MODERATOR', orgA.id)).toBe(true);
    expect(await hasRoleInContext(user, 'ROLE_USER', orgA.id)).toBe(true);
  });

  it('super admin works in all orgs', async () => {
    // Given: User has ROLE_ADMIN with org = null
    // Then: Should pass checks for any org

    expect(await hasRoleInContext(superAdmin, 'ROLE_ADMIN', null)).toBe(true);
    expect(await hasRoleInContext(superAdmin, 'ROLE_ADMIN', orgA.id)).toBe(true);
    expect(await hasRoleInContext(superAdmin, 'ROLE_ADMIN', orgB.id)).toBe(true);
  });

  it('org-scoped roles only work in their org', async () => {
    // Given: User has ROLE_ADMIN in Org A only
    // Then: Should NOT work in Org B

    expect(await hasRoleInContext(user, 'ROLE_ADMIN', orgA.id)).toBe(true);
    expect(await hasRoleInContext(user, 'ROLE_ADMIN', orgB.id)).toBe(false);
  });
});
```

### Integration Tests - Voters

```typescript
describe('OrganizationVoter', () => {
  it('grants access to org admin', async () => {
    // Given: User has ROLE_ADMIN in Org A
    const result = await isGranted(
      user,
      'organization.manage',
      { organizationId: orgA.id, subject: orgA }
    );

    expect(result).toBe(true);
  });

  it('denies access to different org', async () => {
    // Given: User has ROLE_ADMIN in Org A
    const result = await isGranted(
      user,
      'organization.manage',
      { organizationId: orgB.id, subject: orgB }
    );

    expect(result).toBe(false);
  });

  it('only owner can delete org', async () => {
    // Given: User has ROLE_ADMIN (not OWNER)
    const adminResult = await isGranted(
      adminUser,
      'organization.delete',
      { organizationId: orgA.id, subject: orgA }
    );
    expect(adminResult).toBe(false);

    // Given: User has ROLE_OWNER
    const ownerResult = await isGranted(
      ownerUser,
      'organization.delete',
      { organizationId: orgA.id, subject: orgA }
    );
    expect(ownerResult).toBe(true);
  });
});
```

### E2E Tests - API Routes

```typescript
describe('POST /api/admin/organizations', () => {
  it('platform admin can create org', async () => {
    // Given: Super admin (org = null)
    const response = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(response.status).toBe(201);
  });

  it('org admin cannot create org', async () => {
    // Given: Admin of Org A (not super admin)
    const response = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });

    expect(response.status).toBe(403);
  });
});
```

## Implementation Roadmap

### Phase 1: Schema & Core Infrastructure (Week 1)

✅ **Task 1.1: Update Prisma Schema**
- Add `organizationId` to `UserRole` table
- Remove `organizationRole` from `User` table
- Remove `OrganizationRole` enum
- Add `Organization` reverse relation to `UserRole`

✅ **Task 1.2: Update Security Core**
- Modify `isGranted()` to accept `context` parameter
- Implement `hasRoleInContext()` with org filtering
- Update `resolveHierarchy()` to remain org-agnostic
- Remove `ROLES` constant and `getHighestRole()` hardcoded logic

✅ **Task 1.3: Update Voters**
- Add `context` parameter to `Voter.vote()` interface
- Update `OrganizationVoter` with org-scoped checks
- Update `UserVoter` with org-scoped checks

✅ **Task 1.4: Database Reset & Seed**
- Create migration script
- Update seed data with new role structure
- Create test fixtures for common scenarios

### Phase 2: API Layer Updates (Week 1-2)

✅ **Task 2.1: Update API Utilities**
- Create `requireAdmin()` helper with org context
- Create `requireModerator()` helper with org context
- Update `getSessionUser()` to include role context

✅ **Task 2.2: Update Organization Routes**
- `GET /api/admin/organizations` - platform admin only
- `GET /api/organizations/current` - org member check
- `POST /api/organizations` - platform admin only
- `PATCH /api/organizations/[id]` - org admin check
- `DELETE /api/organizations/[id]` - org owner check

✅ **Task 2.3: Update User Management Routes**
- `GET /api/admin/users` - check org context
- `PATCH /api/admin/users/[id]` - check org context
- `POST /api/admin/users/[id]/roles` - assign with org context

✅ **Task 2.4: Update Role Management Routes**
- `GET /api/admin/roles` - return all roles (system + custom)
- `POST /api/admin/roles` - platform admin only
- `PATCH /api/admin/roles/[id]` - protect system roles

### Phase 3: UI Components (Week 2)

✅ **Task 3.1: Update Navigation**
- Remove hardcoded role checks from navbar
- Use `isGranted()` for menu visibility
- Add org context to all checks

✅ **Task 3.2: Update User Management UI**
- Role selector: fetch roles dynamically from API
- Org context selector for role assignments
- Display user's roles per org

✅ **Task 3.3: Update Role Management UI**
- List all roles (system + custom)
- Show role hierarchy visually
- Protect system roles from modification
- Allow creating custom roles

### Phase 4: Testing & Documentation (Week 2-3)

✅ **Task 4.1: Unit Tests**
- Role hierarchy resolution
- Context filtering logic
- Voter decision flows

✅ **Task 4.2: Integration Tests**
- API route authorization
- Cross-org permission denial
- Super admin override behavior

✅ **Task 4.3: E2E Tests**
- Multi-tenant admin workflows
- Role assignment flows
- Permission denial scenarios

✅ **Task 4.4: Documentation**
- Update API documentation
- Create migration guide
- Document common patterns (recipes)
- Add Mermaid diagrams for flows

## Future Extensions

### Extension 1: Hierarchical Organizations

**Pattern for nested organizations:**

```prisma
model Organization {
  id       String  @id @default(cuid())
  name     String
  parentId String? @map("parent_id") // NULL = root org

  parent   Organization?  @relation("OrgHierarchy", fields: [parentId], references: [id])
  children Organization[] @relation("OrgHierarchy")

  userRoles UserRole[]
}
```

**Permission Inheritance:**

```typescript
// Parent org admins can manage child orgs
async function canManageOrg(user, targetOrgId) {
  // 1. Check direct assignment
  if (await hasRoleInContext(user, 'ROLE_ADMIN', targetOrgId)) {
    return true;
  }

  // 2. Check parent org assignments (recursive)
  const org = await prisma.organization.findUnique({
    where: { id: targetOrgId },
  });

  if (org.parentId) {
    return canManageOrg(user, org.parentId); // Recurse up
  }

  return false;
}
```

**Status:** Documented as future extension, not implemented in initial version.

### Extension 2: Permission-Based Roles

- Add `Permission` table
- Link roles to specific permissions
- Replace voter attribute strings with permission checks

### Extension 3: Role Templates

- Pre-configured role bundles (e.g., "Project Manager")
- One-click role creation from templates

### Extension 4: Audit Trail

- Track role assignments/removals
- Log permission grants/denials for compliance

## Success Criteria

- ✅ Single unified role system (no dual platform/org roles)
- ✅ Context-aware authorization (`isGranted` with org context)
- ✅ Super admins work across all organizations
- ✅ Org-scoped roles only work in their organization
- ✅ No hardcoded role assumptions in code
- ✅ Dynamic role hierarchy from database
- ✅ Extensible for custom roles per organization
- ✅ Clean Symfony-style voter pattern
- ✅ Comprehensive test coverage
- ✅ Clear migration path and documentation

## Related Issues

- #182 - Spike: JWT validation with arbitrary role architectures
- #174 - Update UI components to use isGranted pattern

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
