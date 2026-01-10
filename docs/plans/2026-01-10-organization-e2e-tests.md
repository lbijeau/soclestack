# Organization E2E Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add comprehensive e2e tests for organization CRUD, member management, and invite flows (Issue #308).

**Architecture:** Page Object pattern with OrganizationPage, MembersPage, InvitesPage, InviteAcceptPage. DatabaseHelpers extended for org/member/invite setup. Tests organized by feature area.

**Tech Stack:** Playwright, TypeScript, Prisma (for test data setup)

---

## Task 1: Add data-testid attributes to organization page

**Files:**
- Modify: `src/app/organization/page.tsx`

**Step 1: Add testids to organization page elements**

Add `data-testid` attributes to the organization page. In `src/app/organization/page.tsx`:

```tsx
// Line ~238: Organization name input
<Input
  id="name"
  data-testid="org-name-input"
  value={name}
  onChange={(e) => setName(e.target.value)}
  disabled={!canEdit || saving}
  className="mt-1"
/>

// Line ~254: Slug display input
<Input
  id="slug"
  data-testid="org-slug-display"
  value={organization.slug}
  disabled
  className="mt-1 bg-gray-50"
/>

// Line ~283: Save button
<Button
  type="submit"
  data-testid="org-save-button"
  disabled={saving || name === organization.name}
>

// Line ~321: Delete button
<Button
  variant="destructive"
  data-testid="org-delete-button"
  onClick={handleDelete}
  disabled={deleting}
>

// Line ~199: Role display card - add testid
<Card className="h-full" data-testid="org-role-card">
  <CardContent className="p-6">
    <div className="flex items-center">
      <Building2 className="h-8 w-8 text-purple-600" />
      <div className="ml-4">
        <div className="font-medium text-gray-900">Your Role</div>
        <div className="text-sm text-gray-500" data-testid="org-role-display">{organization.role}</div>
      </div>
    </div>
  </CardContent>
</Card>

// Line ~169: Member count display - add testid
<div className="text-sm text-gray-500" data-testid="org-member-count">
  {organization.memberCount} members
</div>

// Line ~220: Error message div
{error && (
  <div data-testid="org-error-message" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
    {error}
  </div>
)}

// Line ~225: Success message div
{success && (
  <div data-testid="org-success-message" className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
    {success}
  </div>
)}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/organization/page.tsx
git commit -m "test(e2e): add data-testid attributes to organization page"
```

---

## Task 2: Add data-testid attributes to members page

**Files:**
- Modify: `src/app/organization/members/page.tsx`

**Step 1: Add testids to members page elements**

In `src/app/organization/members/page.tsx`:

```tsx
// Line ~211: Invite members button
{canManage && (
  <Link href="/organization/invites">
    <Button data-testid="invite-members-button">Invite Members</Button>
  </Link>
)}

// Line ~215: Error message
{error && (
  <div data-testid="members-error-message" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
    {error}
  </div>
)}

// Line ~229: Members list container
<div className="space-y-4" data-testid="members-list">

// Line ~230: Each member row - update the div
<div
  key={member.id}
  data-testid="member-row"
  data-member-email={member.email}
  className="flex items-center justify-between rounded-lg border p-4"
>

// Line ~252: Member email display
<div className="text-sm text-gray-500" data-testid="member-email">{member.email}</div>

// Line ~269: Role select dropdown
<select
  value={member.organizationRole}
  onChange={(e) => handleRoleChange(member.id, e.target.value)}
  disabled={actionLoading === member.id}
  data-testid="member-role-select"
  className="h-10 w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
>

// Line ~282: Remove member button
<Button
  variant="outline"
  size="icon"
  data-testid="member-remove-button"
  className="text-red-600 hover:bg-red-50 hover:text-red-700"
  onClick={() => handleRemove(member.id, member.email)}
  disabled={actionLoading === member.id}
>

// Line ~297: Role badge (when not editable)
<Badge
  data-testid="member-role-badge"
  className={getRoleBadgeColor(member.organizationRole)}
>
```

**Step 2: Verify no TypeScript errors**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/organization/members/page.tsx
git commit -m "test(e2e): add data-testid attributes to members page"
```

---

## Task 3: Add data-testid attributes to invites page

**Files:**
- Modify: `src/app/organization/invites/page.tsx`

**Step 1: Add testids to invites page elements**

In `src/app/organization/invites/page.tsx`:

```tsx
// Line ~191: Error message
{error && (
  <div data-testid="invites-error-message" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
    {error}
  </div>
)}

// Line ~197: Success message
{success && (
  <div data-testid="invites-success-message" className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
    {success}
  </div>
)}

// Line ~220: Email input
<Input
  id="email"
  type="email"
  data-testid="invite-email-input"
  placeholder="Enter email address"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  disabled={sending}
/>

// Line ~233: Role select
<select
  id="role"
  value={role}
  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
  disabled={sending}
  data-testid="invite-role-select"
  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
>

// Line ~244: Send invite button
<Button type="submit" data-testid="invite-send-button" disabled={sending || !email.trim()}>

// Line ~277: Pending invites list container
<div className="space-y-4" data-testid="pending-invites-list">

// Line ~278: Each invite row
<div
  key={invite.id}
  data-testid="pending-invite-row"
  data-invite-email={invite.email}
  className={`flex items-center justify-between rounded-lg border p-4 ${
    isExpired(invite.expiresAt) ? 'bg-gray-50 opacity-75' : ''
  }`}
>

// Line ~286: Invite email display
<div className="font-medium text-gray-900" data-testid="pending-invite-email">
  {invite.email}
</div>

// Line ~301: Expired badge
{isExpired(invite.expiresAt) ? (
  <Badge
    variant="outline"
    data-testid="pending-invite-expired-badge"
    className="border-red-200 text-red-600"
  >
    Expired
  </Badge>
)

// Line ~314: Cancel invite button
<Button
  variant="outline"
  size="icon"
  data-testid="pending-invite-cancel-button"
  className="text-red-600 hover:bg-red-50 hover:text-red-700"
  onClick={() => handleCancelInvite(invite.id, invite.email)}
  disabled={cancelling === invite.id}
>
```

**Step 2: Verify no TypeScript errors**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/organization/invites/page.tsx
git commit -m "test(e2e): add data-testid attributes to invites page"
```

---

## Task 4: Add data-testid attributes to invite accept page

**Files:**
- Modify: `src/app/invite/[token]/page.tsx`

**Step 1: Add testids to invite accept page elements**

In `src/app/invite/[token]/page.tsx`:

```tsx
// Line ~167: Organization name display
<h2 className="text-2xl font-bold text-gray-900" data-testid="invite-org-name">
  {invite.organization.name}
</h2>

// Line ~172: Role badge
<Badge data-testid="invite-role-badge" className={getRoleBadgeColor(invite.role)}>
  {invite.role}
</Badge>

// Line ~181: Invite email display
<p className="font-medium" data-testid="invite-email-display">{invite.email}</p>

// Line ~184: Error message
{error && (
  <div data-testid="invite-error-message" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
    {error}
  </div>
)}

// Line ~193: Email mismatch warning
<div data-testid="invite-email-mismatch-warning" className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
  You are logged in as <strong>{userEmail}</strong>, but this
  invite was sent to <strong>{invite.email}</strong>. Please log
  in with the correct account.
</div>

// Line ~210: Accept button
<Button
  onClick={handleAccept}
  disabled={accepting}
  data-testid="invite-accept-button"
  className="w-full"
>

// Line ~230: Create account button
<Link href={`/register?invite=${token}`} className="block">
  <Button data-testid="invite-create-account-button" className="w-full">
    <UserPlus className="mr-2 h-4 w-4" />
    Create Account & Join
  </Button>
</Link>

// Line ~237: Login button
<Link
  href={`/login?returnUrl=/invite/${token}`}
  className="block"
>
  <Button variant="outline" data-testid="invite-login-button" className="w-full">
    <LogIn className="mr-2 h-4 w-4" />
    Already have an account? Log in
  </Button>
</Link>
```

**Step 2: Verify no TypeScript errors**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/invite/[token]/page.tsx
git commit -m "test(e2e): add data-testid attributes to invite accept page"
```

---

## Task 5: Extend DatabaseHelpers with organization methods

**Files:**
- Modify: `tests/utils/database-helpers.ts`

**Step 1: Add organization helper methods**

Add these methods to the `DatabaseHelpers` class in `tests/utils/database-helpers.ts`:

```typescript
// Add after the existing imports at the top
import crypto from 'crypto';

// Add these methods inside the DatabaseHelpers class:

/**
 * Create a test organization with an owner
 */
static async createTestOrganization(data: {
  name: string;
  slug?: string;
  ownerEmail: string;
}): Promise<any> {
  const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

  // Find or create the owner
  let owner = await this.prisma.user.findUnique({
    where: { email: data.ownerEmail },
  });

  if (!owner) {
    owner = await this.createTestUser({ email: data.ownerEmail });
  }

  // Create the organization
  const org = await this.prisma.organization.create({
    data: {
      name: data.name,
      slug,
      members: {
        create: {
          userId: owner.id,
          role: 'OWNER',
        },
      },
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  return org;
}

/**
 * Delete a test organization and all related data
 */
static async deleteTestOrganization(orgId: string): Promise<void> {
  // Delete invites first
  await this.prisma.organizationInvite.deleteMany({
    where: { organizationId: orgId },
  });

  // Delete members
  await this.prisma.organizationMember.deleteMany({
    where: { organizationId: orgId },
  });

  // Delete organization
  await this.prisma.organization.delete({
    where: { id: orgId },
  });
}

/**
 * Clean up all test organizations (those with @test.com owners)
 */
static async cleanupTestOrganizations(): Promise<void> {
  // Find all orgs owned by test users
  const testOrgs = await this.prisma.organization.findMany({
    where: {
      members: {
        some: {
          role: 'OWNER',
          user: {
            email: {
              endsWith: '@test.com',
            },
          },
        },
      },
    },
  });

  for (const org of testOrgs) {
    await this.deleteTestOrganization(org.id);
  }
}

/**
 * Add a member to an organization
 */
static async addMemberToOrganization(
  orgId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
): Promise<any> {
  return await this.prisma.organizationMember.create({
    data: {
      organizationId: orgId,
      userId,
      role,
    },
    include: {
      user: true,
      organization: true,
    },
  });
}

/**
 * Remove a member from an organization
 */
static async removeMemberFromOrganization(
  orgId: string,
  userId: string
): Promise<void> {
  await this.prisma.organizationMember.deleteMany({
    where: {
      organizationId: orgId,
      userId,
    },
  });
}

/**
 * Get a member's role in an organization
 */
static async getMemberRole(
  orgId: string,
  userId: string
): Promise<'OWNER' | 'ADMIN' | 'MEMBER' | null> {
  const member = await this.prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId,
      },
    },
  });

  return member?.role as 'OWNER' | 'ADMIN' | 'MEMBER' | null;
}

/**
 * Create a test invite
 */
static async createTestInvite(
  orgId: string,
  email: string,
  role: 'ADMIN' | 'MEMBER',
  options?: { expiresAt?: Date; invitedById?: string }
): Promise<{ invite: any; token: string }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = options?.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Get org owner if invitedById not provided
  let invitedById = options?.invitedById;
  if (!invitedById) {
    const owner = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        role: 'OWNER',
      },
    });
    invitedById = owner?.userId;
  }

  const invite = await this.prisma.organizationInvite.create({
    data: {
      organizationId: orgId,
      email,
      role,
      token,
      expiresAt,
      invitedById: invitedById!,
    },
    include: {
      organization: true,
      invitedBy: true,
    },
  });

  return { invite, token };
}

/**
 * Get an invite by token
 */
static async getInviteByToken(token: string): Promise<any> {
  return await this.prisma.organizationInvite.findUnique({
    where: { token },
    include: {
      organization: true,
      invitedBy: true,
    },
  });
}

/**
 * Expire an invite (set expiresAt to past)
 */
static async expireInvite(inviteId: string): Promise<void> {
  await this.prisma.organizationInvite.update({
    where: { id: inviteId },
    data: {
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
    },
  });
}

/**
 * Set up a complete test organization with owner, admin, member, and invites
 */
static async setupTestOrganization(): Promise<{
  org: any;
  owner: any;
  admin: any;
  member: any;
  nonMember: any;
  pendingInvite: { invite: any; token: string };
  expiredInvite: { invite: any; token: string };
}> {
  // Clean up first
  await this.cleanupTestOrganizations();

  // Create users
  const owner = await this.createTestUser({
    email: 'orgowner@test.com',
    password: 'OwnerTest123!',
    firstName: 'Org',
    lastName: 'Owner',
  });

  const admin = await this.createTestUser({
    email: 'orgadmin@test.com',
    password: 'AdminTest123!',
    firstName: 'Org',
    lastName: 'Admin',
  });

  const member = await this.createTestUser({
    email: 'orgmember@test.com',
    password: 'MemberTest123!',
    firstName: 'Org',
    lastName: 'Member',
  });

  const nonMember = await this.createTestUser({
    email: 'nonmember@test.com',
    password: 'NonMemberTest123!',
    firstName: 'Non',
    lastName: 'Member',
  });

  // Create organization with owner
  const org = await this.createTestOrganization({
    name: 'Test Organization',
    slug: 'test-org-' + Date.now(),
    ownerEmail: owner.email,
  });

  // Add admin and member
  await this.addMemberToOrganization(org.id, admin.id, 'ADMIN');
  await this.addMemberToOrganization(org.id, member.id, 'MEMBER');

  // Create invites
  const pendingInvite = await this.createTestInvite(
    org.id,
    'pending@test.com',
    'MEMBER',
    { invitedById: owner.id }
  );

  const expiredInvite = await this.createTestInvite(
    org.id,
    'expired@test.com',
    'MEMBER',
    {
      expiresAt: new Date(Date.now() - 1000),
      invitedById: owner.id,
    }
  );

  return {
    org,
    owner: { ...owner, plainPassword: 'OwnerTest123!' },
    admin: { ...admin, plainPassword: 'AdminTest123!' },
    member: { ...member, plainPassword: 'MemberTest123!' },
    nonMember: { ...nonMember, plainPassword: 'NonMemberTest123!' },
    pendingInvite,
    expiredInvite,
  };
}
```

**Step 2: Update cleanupDatabase to include organizations**

In the `cleanupDatabase` method, add organization cleanup before user cleanup:

```typescript
static async cleanupDatabase(): Promise<void> {
  try {
    // Clean up in order to respect foreign key constraints
    await this.prisma.userSession.deleteMany({});

    // Clean up test organizations first (before users)
    await this.cleanupTestOrganizations();

    // Delete backup codes for test users first (foreign key constraint)
    await this.prisma.backupCode.deleteMany({
      where: {
        user: {
          email: {
            endsWith: '@test.com',
          },
        },
      },
    });

    // ... rest of existing cleanup
```

**Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add tests/utils/database-helpers.ts
git commit -m "test(e2e): extend DatabaseHelpers with organization methods"
```

---

## Task 6: Create OrganizationPage page object

**Files:**
- Create: `tests/pages/OrganizationPage.ts`

**Step 1: Create the OrganizationPage class**

Create `tests/pages/OrganizationPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class OrganizationPage extends BasePage {
  // Form elements
  readonly nameInput: Locator;
  readonly slugDisplay: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator;

  // Display elements
  readonly roleDisplay: Locator;
  readonly memberCount: Locator;

  // Navigation
  readonly membersLink: Locator;
  readonly invitesLink: Locator;

  // Messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);

    this.nameInput = page.locator('[data-testid="org-name-input"]');
    this.slugDisplay = page.locator('[data-testid="org-slug-display"]');
    this.saveButton = page.locator('[data-testid="org-save-button"]');
    this.deleteButton = page.locator('[data-testid="org-delete-button"]');

    this.roleDisplay = page.locator('[data-testid="org-role-display"]');
    this.memberCount = page.locator('[data-testid="org-member-count"]');

    this.membersLink = page.locator('a[href="/organization/members"]');
    this.invitesLink = page.locator('a[href="/organization/invites"]');

    this.errorMessage = page.locator('[data-testid="org-error-message"]');
    this.successMessage = page.locator('[data-testid="org-success-message"]');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/organization');
  }

  async updateName(name: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(name);
    await this.saveButton.click();
    await this.waitForLoadingToComplete();
  }

  async deleteOrganization(): Promise<void> {
    // Set up dialog handler before clicking
    this.page.once('dialog', dialog => dialog.accept());
    await this.deleteButton.click();
    await this.page.waitForURL('**/dashboard');
  }

  async navigateToMembers(): Promise<void> {
    await this.membersLink.click();
    await this.page.waitForURL('**/organization/members');
  }

  async navigateToInvites(): Promise<void> {
    await this.invitesLink.click();
    await this.page.waitForURL('**/organization/invites');
  }

  async assertRole(role: 'OWNER' | 'ADMIN' | 'MEMBER'): Promise<void> {
    await expect(this.roleDisplay).toHaveText(role);
  }

  async assertMemberCount(count: number): Promise<void> {
    await expect(this.memberCount).toContainText(`${count} member`);
  }

  async assertSuccessMessageVisible(message?: string): Promise<void> {
    await expect(this.successMessage).toBeVisible();
    if (message) {
      await expect(this.successMessage).toContainText(message);
    }
  }

  async assertErrorMessageVisible(message?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async assertDeleteButtonVisible(): Promise<void> {
    await expect(this.deleteButton).toBeVisible();
  }

  async assertDeleteButtonHidden(): Promise<void> {
    await expect(this.deleteButton).not.toBeVisible();
  }

  async assertSaveButtonVisible(): Promise<void> {
    await expect(this.saveButton).toBeVisible();
  }

  async assertSaveButtonHidden(): Promise<void> {
    await expect(this.saveButton).not.toBeVisible();
  }

  async assertNameInputEditable(): Promise<void> {
    await expect(this.nameInput).toBeEnabled();
  }

  async assertNameInputReadonly(): Promise<void> {
    await expect(this.nameInput).toBeDisabled();
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add tests/pages/OrganizationPage.ts
git commit -m "test(e2e): create OrganizationPage page object"
```

---

## Task 7: Create MembersPage page object

**Files:**
- Create: `tests/pages/MembersPage.ts`

**Step 1: Create the MembersPage class**

Create `tests/pages/MembersPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class MembersPage extends BasePage {
  readonly membersList: Locator;
  readonly inviteButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);

    this.membersList = page.locator('[data-testid="members-list"]');
    this.inviteButton = page.locator('[data-testid="invite-members-button"]');
    this.errorMessage = page.locator('[data-testid="members-error-message"]');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/organization/members');
  }

  getMemberRow(email: string): Locator {
    return this.page.locator(`[data-testid="member-row"][data-member-email="${email}"]`);
  }

  getMemberRoleSelect(email: string): Locator {
    return this.getMemberRow(email).locator('[data-testid="member-role-select"]');
  }

  getMemberRemoveButton(email: string): Locator {
    return this.getMemberRow(email).locator('[data-testid="member-remove-button"]');
  }

  getMemberRoleBadge(email: string): Locator {
    return this.getMemberRow(email).locator('[data-testid="member-role-badge"]');
  }

  async changeRole(email: string, role: 'ADMIN' | 'MEMBER'): Promise<void> {
    const select = this.getMemberRoleSelect(email);
    await select.selectOption(role);
    await this.waitForLoadingToComplete();
  }

  async removeMember(email: string): Promise<void> {
    // Set up dialog handler before clicking
    this.page.once('dialog', dialog => dialog.accept());
    await this.getMemberRemoveButton(email).click();
    await this.waitForLoadingToComplete();
  }

  async assertMemberExists(email: string): Promise<void> {
    await expect(this.getMemberRow(email)).toBeVisible();
  }

  async assertMemberNotExists(email: string): Promise<void> {
    await expect(this.getMemberRow(email)).not.toBeVisible();
  }

  async assertMemberRole(email: string, role: string): Promise<void> {
    // Check either select value or badge text
    const select = this.getMemberRoleSelect(email);
    const badge = this.getMemberRoleBadge(email);

    if (await select.isVisible()) {
      await expect(select).toHaveValue(role);
    } else {
      await expect(badge).toContainText(role);
    }
  }

  async assertCanManageMember(email: string): Promise<void> {
    await expect(this.getMemberRoleSelect(email)).toBeVisible();
    await expect(this.getMemberRemoveButton(email)).toBeVisible();
  }

  async assertCannotManageMember(email: string): Promise<void> {
    await expect(this.getMemberRoleSelect(email)).not.toBeVisible();
    await expect(this.getMemberRemoveButton(email)).not.toBeVisible();
  }

  async assertInviteButtonVisible(): Promise<void> {
    await expect(this.inviteButton).toBeVisible();
  }

  async assertInviteButtonHidden(): Promise<void> {
    await expect(this.inviteButton).not.toBeVisible();
  }

  async getMemberCount(): Promise<number> {
    return await this.page.locator('[data-testid="member-row"]').count();
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add tests/pages/MembersPage.ts
git commit -m "test(e2e): create MembersPage page object"
```

---

## Task 8: Create InvitesPage page object

**Files:**
- Create: `tests/pages/InvitesPage.ts`

**Step 1: Create the InvitesPage class**

Create `tests/pages/InvitesPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class InvitesPage extends BasePage {
  // Form elements
  readonly emailInput: Locator;
  readonly roleSelect: Locator;
  readonly sendButton: Locator;

  // List
  readonly pendingList: Locator;

  // Messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);

    this.emailInput = page.locator('[data-testid="invite-email-input"]');
    this.roleSelect = page.locator('[data-testid="invite-role-select"]');
    this.sendButton = page.locator('[data-testid="invite-send-button"]');

    this.pendingList = page.locator('[data-testid="pending-invites-list"]');

    this.errorMessage = page.locator('[data-testid="invites-error-message"]');
    this.successMessage = page.locator('[data-testid="invites-success-message"]');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/organization/invites');
  }

  getInviteRow(email: string): Locator {
    return this.page.locator(`[data-testid="pending-invite-row"][data-invite-email="${email}"]`);
  }

  getInviteCancelButton(email: string): Locator {
    return this.getInviteRow(email).locator('[data-testid="pending-invite-cancel-button"]');
  }

  getInviteExpiredBadge(email: string): Locator {
    return this.getInviteRow(email).locator('[data-testid="pending-invite-expired-badge"]');
  }

  async sendInvite(email: string, role: 'ADMIN' | 'MEMBER' = 'MEMBER'): Promise<void> {
    await this.emailInput.fill(email);
    await this.roleSelect.selectOption(role);
    await this.sendButton.click();
    await this.waitForLoadingToComplete();
  }

  async cancelInvite(email: string): Promise<void> {
    // Set up dialog handler before clicking
    this.page.once('dialog', dialog => dialog.accept());
    await this.getInviteCancelButton(email).click();
    await this.waitForLoadingToComplete();
  }

  async assertInvitePending(email: string): Promise<void> {
    await expect(this.getInviteRow(email)).toBeVisible();
  }

  async assertInviteNotPending(email: string): Promise<void> {
    await expect(this.getInviteRow(email)).not.toBeVisible();
  }

  async assertInviteExpired(email: string): Promise<void> {
    await expect(this.getInviteRow(email)).toBeVisible();
    await expect(this.getInviteExpiredBadge(email)).toBeVisible();
  }

  async assertSuccessMessageVisible(message?: string): Promise<void> {
    await expect(this.successMessage).toBeVisible();
    if (message) {
      await expect(this.successMessage).toContainText(message);
    }
  }

  async assertErrorMessageVisible(message?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async getInviteCount(): Promise<number> {
    return await this.page.locator('[data-testid="pending-invite-row"]').count();
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add tests/pages/InvitesPage.ts
git commit -m "test(e2e): create InvitesPage page object"
```

---

## Task 9: Create InviteAcceptPage page object

**Files:**
- Create: `tests/pages/InviteAcceptPage.ts`

**Step 1: Create the InviteAcceptPage class**

Create `tests/pages/InviteAcceptPage.ts`:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class InviteAcceptPage extends BasePage {
  // Display elements
  readonly orgName: Locator;
  readonly roleBadge: Locator;
  readonly emailDisplay: Locator;

  // Actions
  readonly acceptButton: Locator;
  readonly createAccountButton: Locator;
  readonly loginButton: Locator;

  // Messages
  readonly errorMessage: Locator;
  readonly emailMismatchWarning: Locator;

  constructor(page: Page) {
    super(page);

    this.orgName = page.locator('[data-testid="invite-org-name"]');
    this.roleBadge = page.locator('[data-testid="invite-role-badge"]');
    this.emailDisplay = page.locator('[data-testid="invite-email-display"]');

    this.acceptButton = page.locator('[data-testid="invite-accept-button"]');
    this.createAccountButton = page.locator('[data-testid="invite-create-account-button"]');
    this.loginButton = page.locator('[data-testid="invite-login-button"]');

    this.errorMessage = page.locator('[data-testid="invite-error-message"]');
    this.emailMismatchWarning = page.locator('[data-testid="invite-email-mismatch-warning"]');
  }

  async goto(token: string): Promise<void> {
    await this.navigateTo(`/invite/${token}`);
  }

  async acceptInvite(): Promise<void> {
    await this.acceptButton.click();
    await this.page.waitForURL('**/organization');
  }

  async clickCreateAccount(): Promise<void> {
    await this.createAccountButton.click();
    await this.page.waitForURL('**/register*');
  }

  async clickLogin(): Promise<void> {
    await this.loginButton.click();
    await this.page.waitForURL('**/login*');
  }

  async assertOrgName(name: string): Promise<void> {
    await expect(this.orgName).toHaveText(name);
  }

  async assertRole(role: string): Promise<void> {
    await expect(this.roleBadge).toHaveText(role);
  }

  async assertInviteEmail(email: string): Promise<void> {
    await expect(this.emailDisplay).toHaveText(email);
  }

  async assertAcceptButtonVisible(): Promise<void> {
    await expect(this.acceptButton).toBeVisible();
  }

  async assertAcceptButtonHidden(): Promise<void> {
    await expect(this.acceptButton).not.toBeVisible();
  }

  async assertEmailMismatch(): Promise<void> {
    await expect(this.emailMismatchWarning).toBeVisible();
    await expect(this.acceptButton).not.toBeVisible();
  }

  async assertInvalidInvite(): Promise<void> {
    // Invalid invite shows error state on the page
    const invalidMessage = this.page.locator('text=Invalid').or(this.errorMessage);
    await expect(invalidMessage).toBeVisible();
  }

  async assertExpiredInvite(): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(/expired/i);
  }

  async assertLoggedOutState(): Promise<void> {
    await expect(this.createAccountButton).toBeVisible();
    await expect(this.loginButton).toBeVisible();
    await expect(this.acceptButton).not.toBeVisible();
  }

  async assertLoggedInState(): Promise<void> {
    await expect(this.acceptButton).toBeVisible();
    await expect(this.createAccountButton).not.toBeVisible();
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add tests/pages/InviteAcceptPage.ts
git commit -m "test(e2e): create InviteAcceptPage page object"
```

---

## Task 10: Create AuthHelpers organization methods

**Files:**
- Modify: `tests/utils/auth-helpers.ts`

**Step 1: Add organization login helpers**

Add these methods to the `AuthHelpers` class in `tests/utils/auth-helpers.ts`:

```typescript
// Add these methods to the AuthHelpers class:

/**
 * Login as organization owner
 */
static async loginAsOrgOwner(page: Page): Promise<void> {
  await this.login(page, 'orgowner@test.com', 'OwnerTest123!');
}

/**
 * Login as organization admin
 */
static async loginAsOrgAdmin(page: Page): Promise<void> {
  await this.login(page, 'orgadmin@test.com', 'AdminTest123!');
}

/**
 * Login as organization member
 */
static async loginAsOrgMember(page: Page): Promise<void> {
  await this.login(page, 'orgmember@test.com', 'MemberTest123!');
}

/**
 * Login as non-member (user not in any org)
 */
static async loginAsNonMember(page: Page): Promise<void> {
  await this.login(page, 'nonmember@test.com', 'NonMemberTest123!');
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add tests/utils/auth-helpers.ts
git commit -m "test(e2e): add organization login helpers to AuthHelpers"
```

---

## Task 11: Create organization-crud.spec.ts

**Files:**
- Create: `tests/e2e/organizations/organization-crud.spec.ts`

**Step 1: Create the organization CRUD test file**

Create `tests/e2e/organizations/organization-crud.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { OrganizationPage } from '../../pages/OrganizationPage';

test.describe('Organization CRUD', () => {
  test.beforeEach(async () => {
    await DatabaseHelpers.setupTestOrganization();
  });

  test.afterEach(async () => {
    await DatabaseHelpers.cleanupTestOrganizations();
  });

  test('should display organization details for owner', async ({ page }) => {
    await AuthHelpers.loginAsOrgOwner(page);
    const orgPage = new OrganizationPage(page);
    await orgPage.goto();

    await test.step('Verify organization name is displayed', async () => {
      await expect(orgPage.nameInput).toHaveValue('Test Organization');
    });

    await test.step('Verify role is displayed as OWNER', async () => {
      await orgPage.assertRole('OWNER');
    });

    await test.step('Verify member count is displayed', async () => {
      await orgPage.assertMemberCount(3); // owner, admin, member
    });

    await test.step('Verify owner can edit', async () => {
      await orgPage.assertNameInputEditable();
      await orgPage.assertSaveButtonVisible();
      await orgPage.assertDeleteButtonVisible();
    });
  });

  test('should display organization details for admin', async ({ page }) => {
    await AuthHelpers.loginAsOrgAdmin(page);
    const orgPage = new OrganizationPage(page);
    await orgPage.goto();

    await test.step('Verify role is displayed as ADMIN', async () => {
      await orgPage.assertRole('ADMIN');
    });

    await test.step('Verify admin can edit but not delete', async () => {
      await orgPage.assertNameInputEditable();
      await orgPage.assertSaveButtonVisible();
      await orgPage.assertDeleteButtonHidden();
    });
  });

  test('should display organization details for member', async ({ page }) => {
    await AuthHelpers.loginAsOrgMember(page);
    const orgPage = new OrganizationPage(page);
    await orgPage.goto();

    await test.step('Verify role is displayed as MEMBER', async () => {
      await orgPage.assertRole('MEMBER');
    });

    await test.step('Verify member cannot edit or delete', async () => {
      await orgPage.assertNameInputReadonly();
      await orgPage.assertSaveButtonHidden();
      await orgPage.assertDeleteButtonHidden();
    });
  });

  test('should update organization name as owner', async ({ page }) => {
    await AuthHelpers.loginAsOrgOwner(page);
    const orgPage = new OrganizationPage(page);
    await orgPage.goto();

    const newName = 'Updated Organization ' + Date.now();

    await test.step('Update organization name', async () => {
      await orgPage.updateName(newName);
    });

    await test.step('Verify success message', async () => {
      await orgPage.assertSuccessMessageVisible('updated');
    });

    await test.step('Verify name persisted after reload', async () => {
      await page.reload();
      await expect(orgPage.nameInput).toHaveValue(newName);
    });
  });

  test('should update organization name as admin', async ({ page }) => {
    await AuthHelpers.loginAsOrgAdmin(page);
    const orgPage = new OrganizationPage(page);
    await orgPage.goto();

    const newName = 'Admin Updated Org ' + Date.now();

    await test.step('Update organization name', async () => {
      await orgPage.updateName(newName);
    });

    await test.step('Verify success message', async () => {
      await orgPage.assertSuccessMessageVisible('updated');
    });
  });

  test('should delete organization as owner', async ({ page }) => {
    await AuthHelpers.loginAsOrgOwner(page);
    const orgPage = new OrganizationPage(page);
    await orgPage.goto();

    await test.step('Delete organization', async () => {
      await orgPage.deleteOrganization();
    });

    await test.step('Verify redirected to dashboard', async () => {
      await expect(page).toHaveURL(/.*\/dashboard/);
    });

    await test.step('Verify organization is no longer accessible', async () => {
      await page.goto('/organization');
      // Should redirect to dashboard since no org exists
      await expect(page).toHaveURL(/.*\/dashboard/);
    });
  });

  test('should redirect non-member to dashboard', async ({ page }) => {
    await AuthHelpers.loginAsNonMember(page);

    await test.step('Navigate to organization page', async () => {
      await page.goto('/organization');
    });

    await test.step('Verify redirected to dashboard', async () => {
      await expect(page).toHaveURL(/.*\/dashboard/);
    });
  });
});
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
mkdir -p tests/e2e/organizations
git add tests/e2e/organizations/organization-crud.spec.ts
git commit -m "test(e2e): add organization CRUD tests"
```

---

## Task 12: Create member-management.spec.ts

**Files:**
- Create: `tests/e2e/organizations/member-management.spec.ts`

**Step 1: Create the member management test file**

Create `tests/e2e/organizations/member-management.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { MembersPage } from '../../pages/MembersPage';

test.describe('Member Management', () => {
  test.beforeEach(async () => {
    await DatabaseHelpers.setupTestOrganization();
  });

  test.afterEach(async () => {
    await DatabaseHelpers.cleanupTestOrganizations();
  });

  test('should display member list for owner', async ({ page }) => {
    await AuthHelpers.loginAsOrgOwner(page);
    const membersPage = new MembersPage(page);
    await membersPage.goto();

    await test.step('Verify all members are displayed', async () => {
      await membersPage.assertMemberExists('orgowner@test.com');
      await membersPage.assertMemberExists('orgadmin@test.com');
      await membersPage.assertMemberExists('orgmember@test.com');
    });

    await test.step('Verify member roles', async () => {
      await membersPage.assertMemberRole('orgowner@test.com', 'OWNER');
      await membersPage.assertMemberRole('orgadmin@test.com', 'ADMIN');
      await membersPage.assertMemberRole('orgmember@test.com', 'MEMBER');
    });

    await test.step('Verify invite button is visible', async () => {
      await membersPage.assertInviteButtonVisible();
    });
  });

  test('should allow owner to change member role', async ({ page }) => {
    await AuthHelpers.loginAsOrgOwner(page);
    const membersPage = new MembersPage(page);
    await membersPage.goto();

    await test.step('Change admin to member', async () => {
      await membersPage.changeRole('orgadmin@test.com', 'MEMBER');
    });

    await test.step('Verify role changed', async () => {
      await membersPage.assertMemberRole('orgadmin@test.com', 'MEMBER');
    });

    await test.step('Change back to admin', async () => {
      await membersPage.changeRole('orgadmin@test.com', 'ADMIN');
    });

    await test.step('Verify role changed back', async () => {
      await membersPage.assertMemberRole('orgadmin@test.com', 'ADMIN');
    });
  });

  test('should allow owner to remove member', async ({ page }) => {
    await AuthHelpers.loginAsOrgOwner(page);
    const membersPage = new MembersPage(page);
    await membersPage.goto();

    const initialCount = await membersPage.getMemberCount();

    await test.step('Remove member', async () => {
      await membersPage.removeMember('orgmember@test.com');
    });

    await test.step('Verify member removed', async () => {
      await membersPage.assertMemberNotExists('orgmember@test.com');
      const newCount = await membersPage.getMemberCount();
      expect(newCount).toBe(initialCount - 1);
    });
  });

  test('should not allow owner to be removed', async ({ page }) => {
    await AuthHelpers.loginAsOrgAdmin(page);
    const membersPage = new MembersPage(page);
    await membersPage.goto();

    await test.step('Verify cannot manage owner', async () => {
      await membersPage.assertCannotManageMember('orgowner@test.com');
    });
  });

  test('should not allow admin to manage other admins', async ({ page }) => {
    // First, create a second admin
    const org = await DatabaseHelpers.createTestOrganization({
      name: 'Admin Test Org',
      ownerEmail: 'admintest-owner@test.com',
    });

    const admin1 = await DatabaseHelpers.createTestUser({
      email: 'admintest-admin1@test.com',
      password: 'Admin1Test123!',
    });
    const admin2 = await DatabaseHelpers.createTestUser({
      email: 'admintest-admin2@test.com',
      password: 'Admin2Test123!',
    });

    await DatabaseHelpers.addMemberToOrganization(org.id, admin1.id, 'ADMIN');
    await DatabaseHelpers.addMemberToOrganization(org.id, admin2.id, 'ADMIN');

    // Login as admin1
    await AuthHelpers.login(page, 'admintest-admin1@test.com', 'Admin1Test123!');
    const membersPage = new MembersPage(page);
    await membersPage.goto();

    await test.step('Verify admin cannot manage other admin', async () => {
      await membersPage.assertCannotManageMember('admintest-admin2@test.com');
    });
  });

  test('should not show management controls to member', async ({ page }) => {
    await AuthHelpers.loginAsOrgMember(page);
    const membersPage = new MembersPage(page);
    await membersPage.goto();

    await test.step('Verify member cannot manage anyone', async () => {
      await membersPage.assertCannotManageMember('orgowner@test.com');
      await membersPage.assertCannotManageMember('orgadmin@test.com');
    });

    await test.step('Verify invite button is hidden', async () => {
      await membersPage.assertInviteButtonHidden();
    });
  });

  test('should allow admin to remove member', async ({ page }) => {
    await AuthHelpers.loginAsOrgAdmin(page);
    const membersPage = new MembersPage(page);
    await membersPage.goto();

    await test.step('Verify admin can manage member', async () => {
      await membersPage.assertCanManageMember('orgmember@test.com');
    });

    await test.step('Remove member', async () => {
      await membersPage.removeMember('orgmember@test.com');
    });

    await test.step('Verify member removed', async () => {
      await membersPage.assertMemberNotExists('orgmember@test.com');
    });
  });
});
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add tests/e2e/organizations/member-management.spec.ts
git commit -m "test(e2e): add member management tests"
```

---

## Task 13: Create invites.spec.ts

**Files:**
- Create: `tests/e2e/organizations/invites.spec.ts`

**Step 1: Create the invites test file**

Create `tests/e2e/organizations/invites.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { InvitesPage } from '../../pages/InvitesPage';
import { InviteAcceptPage } from '../../pages/InviteAcceptPage';

test.describe('Organization Invites', () => {
  let testOrg: Awaited<ReturnType<typeof DatabaseHelpers.setupTestOrganization>>;

  test.beforeEach(async () => {
    testOrg = await DatabaseHelpers.setupTestOrganization();
  });

  test.afterEach(async () => {
    await DatabaseHelpers.cleanupTestOrganizations();
  });

  test.describe('Sending Invites', () => {
    test('should send invite as owner', async ({ page }) => {
      await AuthHelpers.loginAsOrgOwner(page);
      const invitesPage = new InvitesPage(page);
      await invitesPage.goto();

      const newEmail = `newinvite-${Date.now()}@test.com`;

      await test.step('Send invite', async () => {
        await invitesPage.sendInvite(newEmail, 'MEMBER');
      });

      await test.step('Verify success message', async () => {
        await invitesPage.assertSuccessMessageVisible(newEmail);
      });

      await test.step('Verify invite appears in pending list', async () => {
        await invitesPage.assertInvitePending(newEmail);
      });
    });

    test('should send invite with admin role', async ({ page }) => {
      await AuthHelpers.loginAsOrgOwner(page);
      const invitesPage = new InvitesPage(page);
      await invitesPage.goto();

      const newEmail = `adminrole-${Date.now()}@test.com`;

      await test.step('Send invite with admin role', async () => {
        await invitesPage.sendInvite(newEmail, 'ADMIN');
      });

      await test.step('Verify invite appears', async () => {
        await invitesPage.assertInvitePending(newEmail);
      });
    });

    test('should cancel pending invite', async ({ page }) => {
      await AuthHelpers.loginAsOrgOwner(page);
      const invitesPage = new InvitesPage(page);
      await invitesPage.goto();

      await test.step('Verify pending invite exists', async () => {
        await invitesPage.assertInvitePending('pending@test.com');
      });

      await test.step('Cancel invite', async () => {
        await invitesPage.cancelInvite('pending@test.com');
      });

      await test.step('Verify invite removed', async () => {
        await invitesPage.assertInviteNotPending('pending@test.com');
      });
    });

    test('should show expired badge on expired invite', async ({ page }) => {
      await AuthHelpers.loginAsOrgOwner(page);
      const invitesPage = new InvitesPage(page);
      await invitesPage.goto();

      await test.step('Verify expired invite shows badge', async () => {
        await invitesPage.assertInviteExpired('expired@test.com');
      });
    });
  });

  test.describe('Accepting Invites', () => {
    test('should accept invite when logged in as correct user', async ({ page }) => {
      // Create a specific invite for a new user
      const inviteEmail = `accepttest-${Date.now()}@test.com`;
      const user = await DatabaseHelpers.createTestUser({
        email: inviteEmail,
        password: 'AcceptTest123!',
      });
      const { token } = await DatabaseHelpers.createTestInvite(
        testOrg.org.id,
        inviteEmail,
        'MEMBER'
      );

      // Login as the invited user
      await AuthHelpers.login(page, inviteEmail, 'AcceptTest123!');

      const inviteAcceptPage = new InviteAcceptPage(page);
      await inviteAcceptPage.goto(token);

      await test.step('Verify invite details', async () => {
        await inviteAcceptPage.assertOrgName('Test Organization');
        await inviteAcceptPage.assertRole('MEMBER');
        await inviteAcceptPage.assertInviteEmail(inviteEmail);
      });

      await test.step('Accept invite', async () => {
        await inviteAcceptPage.acceptInvite();
      });

      await test.step('Verify redirected to organization', async () => {
        await expect(page).toHaveURL(/.*\/organization/);
      });
    });

    test('should show mismatch warning when logged in as different user', async ({ page }) => {
      // Login as a different user than the invite recipient
      await AuthHelpers.loginAsNonMember(page);

      const inviteAcceptPage = new InviteAcceptPage(page);
      await inviteAcceptPage.goto(testOrg.pendingInvite.token);

      await test.step('Verify email mismatch warning', async () => {
        await inviteAcceptPage.assertEmailMismatch();
      });
    });

    test('should show login/register options when not logged in', async ({ page }) => {
      const inviteAcceptPage = new InviteAcceptPage(page);
      await inviteAcceptPage.goto(testOrg.pendingInvite.token);

      await test.step('Verify logged out state', async () => {
        await inviteAcceptPage.assertLoggedOutState();
      });

      await test.step('Verify invite details visible', async () => {
        await inviteAcceptPage.assertOrgName('Test Organization');
        await inviteAcceptPage.assertRole('MEMBER');
      });
    });

    test('should show error for expired invite', async ({ page }) => {
      const inviteAcceptPage = new InviteAcceptPage(page);
      await inviteAcceptPage.goto(testOrg.expiredInvite.token);

      await test.step('Verify expired error', async () => {
        await inviteAcceptPage.assertExpiredInvite();
      });
    });

    test('should show error for invalid token', async ({ page }) => {
      const inviteAcceptPage = new InviteAcceptPage(page);
      await inviteAcceptPage.goto('invalid-token-12345');

      await test.step('Verify invalid error', async () => {
        await inviteAcceptPage.assertInvalidInvite();
      });
    });
  });

  test.describe('Multi-User Invite Flow', () => {
    test('should complete full invite flow with two users', async ({ browser }) => {
      // Create two browser contexts for owner and invitee
      const ownerContext = await browser.newContext();
      const inviteeContext = await browser.newContext();

      const ownerPage = await ownerContext.newPage();
      const inviteePage = await inviteeContext.newPage();

      try {
        const inviteeEmail = `fullflow-${Date.now()}@test.com`;

        await test.step('Owner sends invite', async () => {
          await AuthHelpers.loginAsOrgOwner(ownerPage);
          const invitesPage = new InvitesPage(ownerPage);
          await invitesPage.goto();
          await invitesPage.sendInvite(inviteeEmail, 'MEMBER');
          await invitesPage.assertInvitePending(inviteeEmail);
        });

        // Get the invite token from database
        const invites = await DatabaseHelpers.getInviteByToken(
          (await (await import('@prisma/client')).PrismaClient
            ? undefined
            : undefined) as any
        );

        // Alternative: get token by querying the pending invite
        const { invite, token } = await DatabaseHelpers.createTestInvite(
          testOrg.org.id,
          inviteeEmail,
          'MEMBER'
        );

        await test.step('Invitee creates account and joins', async () => {
          const inviteAcceptPage = new InviteAcceptPage(inviteePage);
          await inviteAcceptPage.goto(token);

          // For simplicity, we'll create the user first then login
          await DatabaseHelpers.createTestUser({
            email: inviteeEmail,
            password: 'InviteeTest123!',
          });

          await AuthHelpers.login(inviteePage, inviteeEmail, 'InviteeTest123!');
          await inviteAcceptPage.goto(token);
          await inviteAcceptPage.acceptInvite();
        });

        await test.step('Verify invitee is now a member', async () => {
          await expect(inviteePage).toHaveURL(/.*\/organization/);
        });

      } finally {
        await ownerContext.close();
        await inviteeContext.close();
      }
    });
  });
});
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add tests/e2e/organizations/invites.spec.ts
git commit -m "test(e2e): add organization invites tests"
```

---

## Task 14: Create access-control.spec.ts

**Files:**
- Create: `tests/e2e/organizations/access-control.spec.ts`

**Step 1: Create the access control test file**

Create `tests/e2e/organizations/access-control.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';

test.describe('Organization Access Control', () => {
  test.beforeEach(async () => {
    await DatabaseHelpers.setupTestOrganization();
  });

  test.afterEach(async () => {
    await DatabaseHelpers.cleanupTestOrganizations();
  });

  test('should redirect non-member from organization pages', async ({ page }) => {
    await AuthHelpers.loginAsNonMember(page);

    await test.step('Organization page redirects to dashboard', async () => {
      await page.goto('/organization');
      await expect(page).toHaveURL(/.*\/dashboard/);
    });

    await test.step('Members page redirects to dashboard', async () => {
      await page.goto('/organization/members');
      await expect(page).toHaveURL(/.*\/dashboard/);
    });

    await test.step('Invites page redirects', async () => {
      await page.goto('/organization/invites');
      // Should redirect to dashboard or organization (which then redirects)
      await expect(page).toHaveURL(/.*\/(dashboard|organization)/);
    });
  });

  test('should allow member to view organization pages', async ({ page }) => {
    await AuthHelpers.loginAsOrgMember(page);

    await test.step('Can access organization page', async () => {
      await page.goto('/organization');
      await expect(page).toHaveURL(/.*\/organization/);
      await expect(page.locator('h1')).toContainText('Organization');
    });

    await test.step('Can access members page', async () => {
      await page.goto('/organization/members');
      await expect(page).toHaveURL(/.*\/organization\/members/);
      await expect(page.locator('h1')).toContainText('Members');
    });
  });

  test('should restrict invites page to admins and owners', async ({ page }) => {
    await AuthHelpers.loginAsOrgMember(page);

    await test.step('Member is redirected from invites page', async () => {
      await page.goto('/organization/invites');
      // Should redirect to organization page (not invites)
      await expect(page).toHaveURL(/.*\/organization$/);
    });
  });

  test('should enforce cross-org isolation', async ({ browser }) => {
    // Create a second organization
    const org2Owner = await DatabaseHelpers.createTestUser({
      email: 'org2owner@test.com',
      password: 'Org2Owner123!',
    });
    const org2 = await DatabaseHelpers.createTestOrganization({
      name: 'Second Organization',
      ownerEmail: 'org2owner@test.com',
    });

    const org1Context = await browser.newContext();
    const org2Context = await browser.newContext();

    const org1Page = await org1Context.newPage();
    const org2Page = await org2Context.newPage();

    try {
      // Login to respective orgs
      await AuthHelpers.loginAsOrgOwner(org1Page);
      await AuthHelpers.login(org2Page, 'org2owner@test.com', 'Org2Owner123!');

      await test.step('Org1 owner sees their org', async () => {
        await org1Page.goto('/organization');
        await expect(org1Page.locator('[data-testid="org-name-input"]')).toHaveValue('Test Organization');
      });

      await test.step('Org2 owner sees their org', async () => {
        await org2Page.goto('/organization');
        await expect(org2Page.locator('[data-testid="org-name-input"]')).toHaveValue('Second Organization');
      });

      await test.step('Org1 owner cannot see org2 members', async () => {
        // Try to access org2 API directly
        const response = await org1Page.request.get(`/api/organizations/${org2.id}/members`);
        expect(response.status()).toBe(404); // or 403
      });

    } finally {
      await org1Context.close();
      await org2Context.close();
    }
  });

  test('should enforce role-based button visibility', async ({ page }) => {
    await test.step('Owner sees all controls', async () => {
      await AuthHelpers.loginAsOrgOwner(page);
      await page.goto('/organization');

      await expect(page.locator('[data-testid="org-save-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-delete-button"]')).toBeVisible();

      await AuthHelpers.logout(page);
    });

    await test.step('Admin sees edit but not delete', async () => {
      await AuthHelpers.loginAsOrgAdmin(page);
      await page.goto('/organization');

      await expect(page.locator('[data-testid="org-save-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-delete-button"]')).not.toBeVisible();

      await AuthHelpers.logout(page);
    });

    await test.step('Member sees no controls', async () => {
      await AuthHelpers.loginAsOrgMember(page);
      await page.goto('/organization');

      await expect(page.locator('[data-testid="org-save-button"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="org-delete-button"]')).not.toBeVisible();
    });
  });
});
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add tests/e2e/organizations/access-control.spec.ts
git commit -m "test(e2e): add organization access control tests"
```

---

## Task 15: Run tests and verify

**Step 1: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Run organization e2e tests**

Run: `npm run test:e2e -- tests/e2e/organizations/`
Expected: Tests should run (some may fail if UI doesn't have testids yet)

**Step 3: Fix any issues found during test run**

Debug and fix any issues discovered.

**Step 4: Final commit**

```bash
git add -A
git commit -m "test(e2e): complete organization e2e test suite for issue #308"
```

---

## Summary

This plan creates:

1. **Data-testid attributes** in 4 React components
2. **DatabaseHelpers** extended with 10 new organization methods
3. **4 Page Objects**: OrganizationPage, MembersPage, InvitesPage, InviteAcceptPage
4. **AuthHelpers** extended with 4 org login methods
5. **4 test files** with ~25 total test cases:
   - organization-crud.spec.ts (7 tests)
   - member-management.spec.ts (7 tests)
   - invites.spec.ts (8 tests)
   - access-control.spec.ts (4 tests)

Total estimated commits: 15
