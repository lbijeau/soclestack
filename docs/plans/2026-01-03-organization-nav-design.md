# Organization Navigation Design

> Add organization links to navbar for users who belong to an organization.

## Problem

Organization settings exist at `/organization` but are not discoverable through the navigation. Users must know the URL to access them.

## Decision

Add organization navigation links that appear conditionally based on user membership.

## Design

### Navbar Link

- **Location:** After "Profile", before "Admin" (when visible)
- **Visibility:** Only when `user.organizationId` exists
- **Display:** Building2 icon + "Organization" text
- **Style:** Matches existing nav links

### Quick Actions Menu (Mobile)

Add "Organization" group for mobile access:
- Organization Settings → `/organization`
- Members → `/organization/members`
- Invitations → `/organization/invites` (ADMIN/OWNER only)

Requires passing `organizationId` to `QuickActionsMenu` component.

### Layout Consistency

Create `src/app/organization/layout.tsx` using `AuthenticatedLayout` to match other authenticated sections. Remove duplicate `<Navbar />` from organization pages.

## Files Changed

| File | Change |
|------|--------|
| `src/components/navigation/navbar.tsx` | Add `organizationId` to User interface, add Organization nav link |
| `src/components/navigation/quick-actions-menu.tsx` | Add `organizationId` prop, add Organization group |
| `src/app/organization/layout.tsx` | New file using `AuthenticatedLayout` |
| `src/app/organization/page.tsx` | Remove `<Navbar />` and wrapper div |
| `src/app/organization/members/page.tsx` | Remove `<Navbar />` and wrapper div |
| `src/app/organization/invites/page.tsx` | Remove `<Navbar />` and wrapper div |

## API Changes

None required. `/api/auth/me` already returns `organizationId`.

## Testing

- User with org sees "Organization" in nav and Quick Actions
- User without org sees neither
- Organization pages render correctly with shared layout
- Mobile users can access via Quick Actions menu

## Alternatives Considered

1. **Quick Actions only** - Rejected; organizations are a major feature deserving top-level nav
2. **Show "Create Organization" for users without org** - Rejected; keeps nav simple, users join via invites
3. **Display org name instead of "Organization"** - Rejected; consistent labeling preferred
