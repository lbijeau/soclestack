import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class MembersPage extends BasePage {
  readonly membersList: Locator;
  readonly inviteButton: Locator;
  readonly membersErrorMessage: Locator;
  readonly membersSuccessMessage: Locator;

  constructor(page: Page) {
    super(page);

    this.membersList = page.locator('[data-testid="members-list"]');
    this.inviteButton = page.locator('[data-testid="invite-members-button"]');
    this.membersErrorMessage = page.locator('[data-testid="members-error-message"]');
    this.membersSuccessMessage = page.locator('[data-testid="members-success-message"]');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/organization/members');
    await expect(this.membersList).toBeVisible();
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
    // Set up dialog handler before triggering the action (avoids race condition)
    const dialogPromise = this.page.waitForEvent('dialog').then(dialog => dialog.accept());
    await this.getMemberRemoveButton(email).click();
    await dialogPromise; // Wait for dialog to be handled
    await this.waitForLoadingToComplete();
  }

  async assertMemberExists(email: string): Promise<void> {
    await expect(this.getMemberRow(email)).toBeVisible();
  }

  async assertMemberNotExists(email: string): Promise<void> {
    await expect(this.getMemberRow(email)).not.toBeVisible();
  }

  async assertMemberRole(email: string, role: string): Promise<void> {
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

  async assertSuccessMessageVisible(message?: string): Promise<void> {
    await expect(this.membersSuccessMessage).toBeVisible();
    if (message) {
      await expect(this.membersSuccessMessage).toContainText(message);
    }
  }

  async assertErrorMessageVisible(message?: string): Promise<void> {
    await expect(this.membersErrorMessage).toBeVisible();
    if (message) {
      await expect(this.membersErrorMessage).toContainText(message);
    }
  }
}
