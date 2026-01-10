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
    await expect(this.nameInput).toBeVisible();
  }

  async updateName(name: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(name);
    await this.saveButton.click();
    await this.waitForLoadingToComplete();
  }

  async deleteOrganization(): Promise<void> {
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
