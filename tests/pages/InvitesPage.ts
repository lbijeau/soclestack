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
  readonly invitesErrorMessage: Locator;
  readonly invitesSuccessMessage: Locator;

  constructor(page: Page) {
    super(page);

    this.emailInput = page.locator('[data-testid="invite-email-input"]');
    this.roleSelect = page.locator('[data-testid="invite-role-select"]');
    this.sendButton = page.locator('[data-testid="invite-send-button"]');

    this.pendingList = page.locator('[data-testid="pending-invites-list"]');

    this.invitesErrorMessage = page.locator('[data-testid="invites-error-message"]');
    this.invitesSuccessMessage = page.locator('[data-testid="invites-success-message"]');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/organization/invites');
    await expect(this.pendingList).toBeVisible();
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
    await expect(this.invitesSuccessMessage).toBeVisible();
    if (message) {
      await expect(this.invitesSuccessMessage).toContainText(message);
    }
  }

  async assertErrorMessageVisible(message?: string): Promise<void> {
    await expect(this.invitesErrorMessage).toBeVisible();
    if (message) {
      await expect(this.invitesErrorMessage).toContainText(message);
    }
  }

  async getInviteCount(): Promise<number> {
    return await this.page.locator('[data-testid="pending-invite-row"]').count();
  }
}
