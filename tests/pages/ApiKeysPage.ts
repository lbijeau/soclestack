import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for API Keys management (/profile/security)
 */
export class ApiKeysPage extends BasePage {
  // Main elements
  readonly createKeyButton: Locator;
  readonly keysList: Locator;
  readonly emptyMessage: Locator;

  // Create modal elements
  readonly createModal: Locator;
  readonly nameInput: Locator;
  readonly permissionSelect: Locator;
  readonly cancelCreateButton: Locator;
  readonly confirmCreateButton: Locator;

  // New key modal elements
  readonly newKeyModal: Locator;
  readonly newKeyValue: Locator;
  readonly copyKeyButton: Locator;
  readonly copyConfirmedCheckbox: Locator;
  readonly closeNewKeyModalButton: Locator;

  constructor(page: Page) {
    super(page);

    // Main elements
    this.createKeyButton = this.page.locator('[data-testid="create-api-key-button"]');
    this.keysList = this.page.locator('[data-testid="api-keys-list"]');
    this.emptyMessage = this.page.locator('[data-testid="empty-keys-message"]');

    // Create modal elements
    this.createModal = this.page.locator('[data-testid="create-key-modal"]');
    this.nameInput = this.page.locator('[data-testid="api-key-name-input"]');
    this.permissionSelect = this.page.locator('[data-testid="api-key-permission-select"]');
    this.cancelCreateButton = this.page.locator('[data-testid="cancel-create-key-button"]');
    this.confirmCreateButton = this.page.locator('[data-testid="confirm-create-key-button"]');

    // New key modal elements
    this.newKeyModal = this.page.locator('[data-testid="new-key-modal"]');
    this.newKeyValue = this.page.locator('[data-testid="new-api-key-value"]');
    this.copyKeyButton = this.page.locator('[data-testid="copy-api-key-button"]');
    this.copyConfirmedCheckbox = this.page.locator('[data-testid="copy-confirmed-checkbox"]');
    this.closeNewKeyModalButton = this.page.locator('[data-testid="close-new-key-modal-button"]');
  }

  /**
   * Navigate to the security settings page where API keys are managed
   */
  async goto(): Promise<void> {
    await this.navigateTo('/profile/security');
    // Wait for API keys section to load
    await this.page.waitForSelector('[data-testid="create-api-key-button"], [data-testid="empty-keys-message"]', {
      timeout: 10000,
    });
  }

  /**
   * Open the create key modal
   */
  async openCreateModal(): Promise<void> {
    await this.createKeyButton.click();
    await expect(this.createModal).toBeVisible();
  }

  /**
   * Create a new API key with the given name and permission
   */
  async createKey(name: string, permission: 'READ_ONLY' | 'READ_WRITE' = 'READ_ONLY'): Promise<string> {
    await this.openCreateModal();

    // Fill in the form
    await this.nameInput.fill(name);
    await this.permissionSelect.selectOption(permission);

    // Submit
    await this.confirmCreateButton.click();

    // Wait for new key modal to appear
    await expect(this.newKeyModal).toBeVisible({ timeout: 10000 });

    // Get the key value
    const keyValue = await this.newKeyValue.textContent();
    if (!keyValue) {
      throw new Error('Failed to get new API key value');
    }

    return keyValue.trim();
  }

  /**
   * Close the new key modal after copying
   */
  async closeNewKeyModal(confirmCopy = true): Promise<void> {
    if (confirmCopy) {
      await this.copyConfirmedCheckbox.check();
    }
    await this.closeNewKeyModalButton.click();
    await expect(this.newKeyModal).not.toBeVisible();
  }

  /**
   * Get a key item by name
   */
  getKeyByName(name: string): Locator {
    return this.page.locator(`[data-key-name="${name}"]`);
  }

  /**
   * Delete a key by name
   */
  async deleteKey(name: string): Promise<void> {
    const keyItem = this.getKeyByName(name);
    await expect(keyItem).toBeVisible();

    // Set up dialog handler for confirmation
    this.page.once('dialog', (dialog) => dialog.accept());

    // Click delete button within this key item
    await keyItem.locator('[data-testid="delete-api-key-button"]').click();

    // Wait for key to be removed
    await expect(keyItem).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Get all key names currently displayed
   */
  async getKeyNames(): Promise<string[]> {
    const nameElements = this.page.locator('[data-testid="api-key-name"]');
    const count = await nameElements.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const name = await nameElements.nth(i).textContent();
      if (name) {
        names.push(name.trim());
      }
    }

    return names;
  }

  /**
   * Get count of API keys displayed
   */
  async getKeyCount(): Promise<number> {
    const keys = this.page.locator('[data-testid^="api-key-item-"]');
    return keys.count();
  }

  /**
   * Assert that no keys are displayed
   */
  async assertNoKeys(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible();
  }

  /**
   * Assert that keys list is visible with at least one key
   */
  async assertHasKeys(): Promise<void> {
    await expect(this.keysList).toBeVisible();
  }

  /**
   * Assert a key with given name exists
   */
  async assertKeyExists(name: string): Promise<void> {
    const keyItem = this.getKeyByName(name);
    await expect(keyItem).toBeVisible();
  }

  /**
   * Assert a key with given name does not exist
   */
  async assertKeyNotExists(name: string): Promise<void> {
    const keyItem = this.getKeyByName(name);
    await expect(keyItem).not.toBeVisible();
  }
}
