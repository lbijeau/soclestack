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
  readonly loginButtonMismatch: Locator;

  // Messages
  readonly inviteErrorMessage: Locator;
  readonly emailMismatchWarning: Locator;

  constructor(page: Page) {
    super(page);

    this.orgName = page.locator('[data-testid="invite-org-name"]');
    this.roleBadge = page.locator('[data-testid="invite-role-badge"]');
    this.emailDisplay = page.locator('[data-testid="invite-email-display"]');

    this.acceptButton = page.locator('[data-testid="invite-accept-button"]');
    this.createAccountButton = page.locator('[data-testid="invite-create-account-button"]');
    this.loginButton = page.locator('[data-testid="invite-login-button"]');
    this.loginButtonMismatch = page.locator('[data-testid="invite-login-button-mismatch"]');

    this.inviteErrorMessage = page.locator('[data-testid="invite-error-message"]');
    this.emailMismatchWarning = page.locator('[data-testid="invite-email-mismatch-warning"]');
  }

  async goto(token: string): Promise<void> {
    await this.navigateTo(`/invite/${token}`);
    await expect(this.orgName).toBeVisible();
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
    const invalidMessage = this.page.locator('text=Invalid').or(this.inviteErrorMessage);
    await expect(invalidMessage).toBeVisible();
  }

  async assertExpiredInvite(): Promise<void> {
    await expect(this.inviteErrorMessage).toBeVisible();
    await expect(this.inviteErrorMessage).toContainText(/expired/i);
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
