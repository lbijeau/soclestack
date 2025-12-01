# Organizations Design

**Date:** 2025-11-30
**Status:** Ready for implementation

## Overview

Multi-tenant architecture where users belong to organizations with logical data isolation.

**Key decisions:**
- Logical isolation (tenant_id column pattern)
- Single organization per user
- Organization-specific roles: OWNER, ADMIN, MEMBER
- Self-service org creation on registration
- Email invitations for adding users
- Org-scoped audit logs

**Global ADMIN role:**
- Existing `Role.ADMIN` becomes "system admin" (super admin)
- Can access all organizations for support/debugging
- Separate from organization-level ADMIN

## Database Schema

**New Organization model:**
```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique  // URL-friendly identifier
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users     User[]
  invites   OrganizationInvite[]

  @@map("organizations")
}
```

**New OrganizationInvite model:**
```prisma
model OrganizationInvite {
  id             String           @id @default(cuid())
  email          String
  role           OrganizationRole @default(MEMBER)
  token          String           @unique
  expiresAt      DateTime         @map("expires_at")
  organizationId String           @map("organization_id")
  invitedById    String           @map("invited_by_id")
  createdAt      DateTime         @default(now()) @map("created_at")

  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  invitedBy      User             @relation(fields: [invitedById], references: [id])

  @@map("organization_invites")
}
```

**User model additions:**
```prisma
model User {
  // ... existing fields
  organizationId   String?          @map("organization_id")
  organizationRole OrganizationRole @default(MEMBER) @map("organization_role")

  organization     Organization?    @relation(fields: [organizationId], references: [id])
  sentInvites      OrganizationInvite[]
}

enum OrganizationRole {
  OWNER   // Full control, can delete org
  ADMIN   // Manage users, settings
  MEMBER  // Basic access
}
```

## Registration Flow

**New user registration:**
1. User submits registration form with `organizationName`
2. System creates Organization with user as OWNER
3. System creates User linked to Organization
4. Slug auto-generated from org name

**Invited user registration:**
1. User clicks invite link with token
2. Registration form pre-fills email
3. System creates User linked to invite's organization with invite's role
4. Invite deleted

**Existing user accepting invite:**
1. User clicks invite link while logged in
2. If user has no org: join the inviting organization
3. If user already has org: error

**Validation:**
- Must have either `organizationName` OR `inviteToken` (not both, not neither)

## API Endpoints

**Organization management:**
- `POST /api/organizations` - Create org (for existing users without one)
- `GET /api/organizations/current` - Get current user's organization
- `PATCH /api/organizations/current` - Update org (ADMIN+)
- `DELETE /api/organizations/current` - Delete org (OWNER only)

**Member management:**
- `GET /api/organizations/current/members` - List members (all roles)
- `PATCH /api/organizations/current/members/[id]` - Update member role (ADMIN+)
- `DELETE /api/organizations/current/members/[id]` - Remove member (ADMIN+)

**Invitations:**
- `POST /api/organizations/current/invites` - Send invite (ADMIN+)
- `GET /api/organizations/current/invites` - List pending invites (ADMIN+)
- `DELETE /api/organizations/current/invites/[id]` - Cancel invite (ADMIN+)
- `GET /api/invites/[token]` - Get invite details (public)
- `POST /api/invites/[token]/accept` - Accept invite (authenticated)

**Audit logs:**
- Modify `GET /api/admin/audit-logs` to filter by user's organizationId
- System ADMINs can pass `?organizationId=all` to see everything

## UI Changes

**New pages:**
- `/organization` - Organization settings (ADMIN+)
- `/organization/members` - Member list (ADMIN+)
- `/organization/invites` - Pending invitations (ADMIN+)
- `/invite/[token]` - Accept invitation page

**Registration changes:**
- Add "Organization Name" field
- Handle `?invite=TOKEN` query param

**Navigation:**
- Add "Organization" section for ADMIN+ users
- Show organization name in header

## File Structure

**Create:**
```
src/
├── app/
│   ├── api/
│   │   ├── organizations/
│   │   │   ├── route.ts
│   │   │   └── current/
│   │   │       ├── route.ts
│   │   │       ├── members/
│   │   │       │   ├── route.ts
│   │   │       │   └── [id]/route.ts
│   │   │       └── invites/
│   │   │           ├── route.ts
│   │   │           └── [id]/route.ts
│   │   └── invites/
│   │       └── [token]/
│   │           ├── route.ts
│   │           └── accept/route.ts
│   ├── organization/
│   │   ├── page.tsx
│   │   ├── members/page.tsx
│   │   └── invites/page.tsx
│   └── invite/
│       └── [token]/page.tsx
├── components/
│   └── organization/
│       ├── member-list.tsx
│       ├── invite-form.tsx
│       └── org-settings-form.tsx
└── lib/
    └── organization.ts
```

**Modify:**
- `prisma/schema.prisma`
- `src/app/api/auth/register/route.ts`
- `src/app/api/admin/audit-logs/route.ts`
- `src/middleware.ts`
- `src/types/auth.ts`
