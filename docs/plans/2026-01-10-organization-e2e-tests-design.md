# E2E Organization Tests Design

Issue: #308
Date: 2026-01-10

## Overview

Add comprehensive e2e tests for organization CRUD, member management, and invite flows.

## Architecture

### Page Objects

| Page Object | Responsibility |
|-------------|----------------|
| `OrganizationPage.ts` | Org dashboard, settings, delete |
| `MembersPage.ts` | Member list, role changes, removal |
| `InvitesPage.ts` | Send invites, pending list, cancel |
| `InviteAcceptPage.ts` | Public invite acceptance flow |

### Test Files

| File | Tests |
|------|-------|
| `organization-crud.spec.ts` | Create, view, update, delete org |
| `member-management.spec.ts` | Member roles, removal, edge cases |
| `invites.spec.ts` | Send, accept, cancel, expire invites |
| `access-control.spec.ts` | Role-based permissions within org |

## Page Object Definitions

### OrganizationPage

```typescript
class OrganizationPage extends BasePage {
  // Selectors
  orgNameInput: Locator;
  saveButton: Locator;
  deleteButton: Locator;
  membersLink: Locator;
  invitesLink: Locator;
  roleDisplay: Locator;
  memberCountDisplay: Locator;

  // Actions
  async updateName(name: string): Promise<void>;
  async deleteOrganization(): Promise<void>;
  async navigateToMembers(): Promise<void>;
  async navigateToInvites(): Promise<void>;
  async assertRole(role: 'OWNER' | 'ADMIN' | 'MEMBER'): Promise<void>;
  async assertMemberCount(count: number): Promise<void>;
}
```

### MembersPage

```typescript
class MembersPage extends BasePage {
  // Selectors
  memberList: Locator;
  inviteButton: Locator;

  // Actions
  getMemberRow(email: string): Locator;
  async changeRole(email: string, role: 'ADMIN' | 'MEMBER'): Promise<void>;
  async removeMember(email: string): Promise<void>;
  async assertMemberExists(email: string): Promise<void>;
  async assertMemberRole(email: string, role: string): Promise<void>;
  async assertCannotManage(email: string): Promise<void>;
}
```

### InvitesPage

```typescript
class InvitesPage extends BasePage {
  // Selectors
  emailInput: Locator;
  roleSelect: Locator;
  sendButton: Locator;
  pendingList: Locator;

  // Actions
  async sendInvite(email: string, role: 'ADMIN' | 'MEMBER'): Promise<void>;
  async cancelInvite(email: string): Promise<void>;
  async assertInvitePending(email: string): Promise<void>;
  async assertInviteExpired(email: string): Promise<void>;
}
```

### InviteAcceptPage

```typescript
class InviteAcceptPage extends BasePage {
  // Selectors
  orgName: Locator;
  inviteRole: Locator;
  acceptButton: Locator;
  createAccountButton: Locator;
  loginButton: Locator;
  errorMessage: Locator;
  emailMismatchWarning: Locator;

  // Actions
  async acceptInvite(): Promise<void>;
  async assertEmailMismatch(loggedInEmail: string, inviteEmail: string): Promise<void>;
  async assertInvalidInvite(): Promise<void>;
  async assertExpiredInvite(): Promise<void>;
}
```

## DatabaseHelpers Additions

```typescript
// Organization CRUD
static async createTestOrganization(data: {
  name: string;
  slug: string;
  ownerEmail: string;
}): Promise<Organization>;

static async deleteTestOrganization(orgId: string): Promise<void>;

static async cleanupTestOrganizations(): Promise<void>;

// Membership management
static async addMemberToOrganization(
  orgId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
): Promise<OrganizationMember>;

static async removeMemberFromOrganization(
  orgId: string,
  userId: string
): Promise<void>;

static async getMemberRole(
  orgId: string,
  userId: string
): Promise<'OWNER' | 'ADMIN' | 'MEMBER' | null>;

// Invite management
static async createTestInvite(
  orgId: string,
  email: string,
  role: 'ADMIN' | 'MEMBER',
  options?: { expiresAt?: Date }
): Promise<{ invite: OrganizationInvite; token: string }>;

static async getInviteByToken(token: string): Promise<OrganizationInvite | null>;

static async expireInvite(inviteId: string): Promise<void>;

// Complete test setup
static async setupTestOrganization(): Promise<{
  org: Organization;
  owner: User;
  admin: User;
  member: User;
  pendingInvite: { invite: OrganizationInvite; token: string };
  expiredInvite: { invite: OrganizationInvite; token: string };
}>;
```

## Test Cases

### organization-crud.spec.ts

1. **Create new organization**
   - Navigate to org creation
   - Fill form with name
   - Submit and verify redirect to org page
   - Verify user is shown as OWNER

2. **View organization details**
   - Login as org member
   - Navigate to /organization
   - Verify name, slug, member count, role displayed

3. **Update organization name**
   - Login as owner/admin
   - Change name in form
   - Submit and verify success message
   - Reload and verify name persisted

4. **Delete organization (owner only)**
   - Login as owner
   - Click delete button
   - Accept confirm dialog
   - Verify redirect to dashboard
   - Verify org no longer accessible

### member-management.spec.ts

1. **View member list**
   - Login as any org member
   - Navigate to /organization/members
   - Verify all members shown with correct roles

2. **Change member role**
   - Login as owner
   - Change admin to member (and vice versa)
   - Verify role updated in list

3. **Remove member**
   - Login as owner/admin
   - Click remove on a member
   - Accept confirm dialog
   - Verify member removed from list

4. **Owner cannot be removed**
   - Login as admin
   - Verify no remove button for owner
   - Or button disabled/hidden

5. **Admin cannot remove other admins**
   - Login as admin
   - Verify cannot remove another admin
   - API returns 403 if attempted

6. **Member cannot manage anyone**
   - Login as member
   - Verify no role select dropdowns
   - Verify no remove buttons

### invites.spec.ts

1. **Send invite**
   - Login as owner/admin
   - Fill email and select role
   - Submit and verify appears in pending list

2. **Cancel pending invite**
   - Login as owner/admin
   - Click cancel on pending invite
   - Accept confirm dialog
   - Verify removed from list

3. **Accept invite (existing user, logged in)**
   - Create invite for existing user's email
   - Login as that user
   - Navigate to /invite/[token]
   - Click accept
   - Verify redirects to /organization
   - Verify user is now a member

4. **Accept invite (new user)**
   - Create invite for new email
   - Navigate to /invite/[token] (not logged in)
   - Click "Create Account & Join"
   - Complete registration
   - Verify user joins org after registration

5. **Accept invite (wrong email logged in)**
   - Create invite for email A
   - Login as email B
   - Navigate to /invite/[token]
   - Verify mismatch warning shown
   - Verify accept button not available

6. **Expired invite**
   - Create invite with past expiresAt
   - Navigate to /invite/[token]
   - Verify expired error shown

7. **Invalid/used invite token**
   - Navigate to /invite/invalid-token
   - Verify invalid error shown

### access-control.spec.ts

1. **Only members see org pages**
   - Login as non-member
   - Navigate to /organization
   - Verify 404 or redirect

2. **Member sees read-only view**
   - Login as member
   - Navigate to /organization
   - Verify no edit button, no delete button

3. **Admin can edit but not delete**
   - Login as admin
   - Verify can edit org name
   - Verify delete button hidden

4. **Cross-org isolation**
   - Create two orgs with different members
   - Login as org A member
   - Try to access org B endpoints
   - Verify 403/404

## Data-testid Attributes Needed

### src/app/organization/page.tsx
- `org-name-input`
- `org-slug-display`
- `org-save-button`
- `org-delete-button`
- `org-role-display`
- `org-member-count`
- `org-members-link`
- `org-invites-link`
- `org-success-message`
- `org-error-message`

### src/app/organization/members/page.tsx
- `members-list`
- `member-row` (per member)
- `member-email` (per member)
- `member-role-select` (per member)
- `member-remove-button` (per member)
- `member-role-badge` (per member)
- `invite-members-button`

### src/app/organization/invites/page.tsx
- `invite-email-input`
- `invite-role-select`
- `invite-send-button`
- `pending-invites-list`
- `pending-invite-row` (per invite)
- `pending-invite-email` (per invite)
- `pending-invite-cancel-button` (per invite)
- `pending-invite-expired-badge` (per invite)

### src/app/invite/[token]/page.tsx
- `invite-org-name`
- `invite-role-badge`
- `invite-email-display`
- `invite-accept-button`
- `invite-create-account-button`
- `invite-login-button`
- `invite-error-message`
- `invite-email-mismatch-warning`

## Implementation Phases

### Phase 1: Add data-testid attributes
- Update organization page components
- Update invite page components

### Phase 2: Extend DatabaseHelpers
- Add organization helper methods
- Add invite helper methods
- Extend cleanup to handle organizations

### Phase 3: Create Page Objects
- OrganizationPage.ts
- MembersPage.ts
- InvitesPage.ts
- InviteAcceptPage.ts

### Phase 4: Write tests
1. organization-crud.spec.ts
2. member-management.spec.ts
3. invites.spec.ts
4. access-control.spec.ts

## Technical Notes

### Browser Dialog Handling
For confirm dialogs (delete org, remove member):
```typescript
page.on('dialog', dialog => dialog.accept());
```

### Multi-User Tests
Use separate browser contexts for invite acceptance tests:
```typescript
const inviterContext = await browser.newContext();
const inviteeContext = await browser.newContext();
```

### Cleanup Strategy
- Organizations created by test users (`*@test.com`) are cleaned up
- Invites associated with test orgs are cascade deleted
- `cleanupDatabase()` extended to include org cleanup
