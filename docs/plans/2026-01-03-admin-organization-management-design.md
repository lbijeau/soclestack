# Admin Organization Management Design

**Date:** 2026-01-03
**Status:** Approved

## Overview

Add admin UI for monitoring and managing organizations. Admins can view all organizations, transfer ownership, remove members, and delete organizations. Users continue to create and manage their own organizations - admin provides oversight and intervention capabilities.

## Approach

**Monitor & Intervene** - Users create orgs, admin has oversight powers to fix issues.

What admin CAN do:
- View all organizations and members
- Transfer ownership to another member
- Remove members from organizations
- Delete organizations entirely

What admin CANNOT do:
- Create organizations (users do this)
- Add users to organizations (done via invites)
- Change org name/slug (owner does this)

## Admin Organizations Page

### List View (`/admin/organizations`)

Table showing all organizations:
- Name, Slug, Owner, Member Count, Created Date
- Search by name/slug
- Sort by name, member count, or date
- Click row to view details

### Detail View (`/admin/organizations/[id]`)

- Organization info (name, slug, created date)
- Member list with roles (OWNER/ADMIN/MEMBER)
- Actions:
  - Transfer ownership - Reassign OWNER to another member
  - Remove member - Remove any member except owner
  - Delete organization - Remove org entirely (requires confirmation)

## API Endpoints

```
GET    /api/admin/organizations                        - List all orgs (paginated, searchable)
GET    /api/admin/organizations/[id]                   - Get org details + members
PATCH  /api/admin/organizations/[id]                   - Transfer ownership
DELETE /api/admin/organizations/[id]                   - Delete organization
DELETE /api/admin/organizations/[id]/members/[userId]  - Remove member
```

### Authorization

All endpoints require `ADMIN` role (not MODERATOR).

### List Response

```typescript
{
  organizations: [{
    id, name, slug, createdAt,
    memberCount: number,
    owner: { id, email, firstName, lastName }
  }],
  pagination: { page, limit, total, totalPages }
}
```

### Transfer Ownership

- New owner must already be a member
- Old owner becomes ADMIN (not removed)
- Creates audit log entry

## UI Components

### Admin Panel Integration

- Add "Organizations" card to Admin Tools grid (alongside Audit Logs)
- Add org count to admin stats bar

### OrganizationList Component

- Reuses existing table patterns from UserManagement
- Search input + pagination
- Columns: Name, Slug, Owner, Members, Created
- Row click navigates to detail page

### OrganizationDetail Component

- Back link to list
- Info card with org details
- Members table with role badges
- Action buttons:
  - "Transfer Ownership" - modal with member dropdown
  - "Remove" button per member row (except owner)
  - "Delete Organization" - danger zone card at bottom

### Confirmation Modals

- Transfer: "Transfer ownership of {org} to {user}?"
- Remove member: "Remove {user} from {org}?"
- Delete org: Red warning, type org name to confirm

## Files

### Create

- `src/app/admin/organizations/page.tsx` - List view
- `src/app/admin/organizations/[id]/page.tsx` - Detail view
- `src/components/admin/organization-list.tsx` - List component
- `src/components/admin/organization-detail.tsx` - Detail component
- `src/app/api/admin/organizations/route.ts` - List endpoint
- `src/app/api/admin/organizations/[id]/route.ts` - Detail/update/delete
- `src/app/api/admin/organizations/[id]/members/[userId]/route.ts` - Remove member

### Modify

- `src/app/admin/page.tsx` - Add Organizations card + stat

## Audit Events

- `ADMIN_ORG_OWNERSHIP_TRANSFER`
- `ADMIN_ORG_MEMBER_REMOVED`
- `ADMIN_ORG_DELETED`

## Not Included (YAGNI)

- Bulk operations on orgs
- Organization creation by admin
- Adding users to orgs directly
- Editing org name/slug
