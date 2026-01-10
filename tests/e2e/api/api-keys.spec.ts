import { test, expect } from '@playwright/test';
import { ApiKeysPage } from '../../pages/ApiKeysPage';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('API Keys Management', () => {
  let apiKeysPage: ApiKeysPage;

  test.beforeEach(async ({ page }) => {
    // Login as regular user
    await AuthHelpers.loginAsUser(page);

    apiKeysPage = new ApiKeysPage(page);
    await apiKeysPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Clean up - logout
    try {
      await AuthHelpers.logout(page);
    } catch {
      // Ignore logout errors
    }
  });

  test.describe('Create API Key', () => {
    test('should create an API key with name and display secret once', async ({ page }) => {
      const keyName = `Test Key ${Date.now()}`;

      await test.step('Open create modal', async () => {
        await apiKeysPage.openCreateModal();
        await expect(apiKeysPage.createModal).toBeVisible();
      });

      let apiKey: string;
      await test.step('Fill form and create key', async () => {
        apiKey = await apiKeysPage.createKey(keyName);
        expect(apiKey).toBeTruthy();
        expect(apiKey.length).toBeGreaterThan(20); // API keys should be reasonably long
      });

      await test.step('Verify key is shown in new key modal', async () => {
        await expect(apiKeysPage.newKeyModal).toBeVisible();
        await expect(apiKeysPage.newKeyValue).toContainText(apiKey!.substring(0, 10));
      });

      await test.step('Close modal and verify key in list', async () => {
        await apiKeysPage.closeNewKeyModal();
        await apiKeysPage.assertKeyExists(keyName);
      });

      // Clean up - delete the key we created
      await test.step('Cleanup - delete created key', async () => {
        await apiKeysPage.deleteKey(keyName);
      });
    });

    test('should show copy button functionality', async ({ page }) => {
      const keyName = `Copy Test ${Date.now()}`;

      await apiKeysPage.createKey(keyName);

      await test.step('Verify copy button exists', async () => {
        await expect(apiKeysPage.copyKeyButton).toBeVisible();
        await expect(apiKeysPage.copyKeyButton).toContainText('Copy');
      });

      await test.step('Close modal', async () => {
        await apiKeysPage.closeNewKeyModal();
      });

      // Clean up
      await apiKeysPage.deleteKey(keyName);
    });

    test('should require confirmation checkbox to close modal without warning', async ({ page }) => {
      const keyName = `Confirm Test ${Date.now()}`;

      await apiKeysPage.createKey(keyName);

      await test.step('Verify confirmation checkbox exists', async () => {
        await expect(apiKeysPage.copyConfirmedCheckbox).toBeVisible();
        await expect(apiKeysPage.copyConfirmedCheckbox).not.toBeChecked();
      });

      await test.step('Check confirmation and close', async () => {
        await apiKeysPage.copyConfirmedCheckbox.check();
        await expect(apiKeysPage.copyConfirmedCheckbox).toBeChecked();
        await apiKeysPage.closeNewKeyModalButton.click();
        await expect(apiKeysPage.newKeyModal).not.toBeVisible();
      });

      // Clean up
      await apiKeysPage.deleteKey(keyName);
    });

    test('should add new key to the list after creation', async ({ page }) => {
      const keyName = `List Test ${Date.now()}`;

      const initialCount = await apiKeysPage.getKeyCount();

      await apiKeysPage.createKey(keyName);
      await apiKeysPage.closeNewKeyModal();

      await test.step('Verify key count increased', async () => {
        const newCount = await apiKeysPage.getKeyCount();
        expect(newCount).toBe(initialCount + 1);
      });

      await test.step('Verify key name in list', async () => {
        const names = await apiKeysPage.getKeyNames();
        expect(names).toContain(keyName);
      });

      // Clean up
      await apiKeysPage.deleteKey(keyName);
    });

    test('should create key with different permissions', async ({ page }) => {
      const readOnlyKeyName = `Read Only ${Date.now()}`;
      const readWriteKeyName = `Read Write ${Date.now()}`;

      await test.step('Create read-only key', async () => {
        await apiKeysPage.createKey(readOnlyKeyName, 'READ_ONLY');
        await apiKeysPage.closeNewKeyModal();
        await apiKeysPage.assertKeyExists(readOnlyKeyName);
      });

      await test.step('Create read-write key', async () => {
        await apiKeysPage.createKey(readWriteKeyName, 'READ_WRITE');
        await apiKeysPage.closeNewKeyModal();
        await apiKeysPage.assertKeyExists(readWriteKeyName);
      });

      // Clean up
      await apiKeysPage.deleteKey(readOnlyKeyName);
      await apiKeysPage.deleteKey(readWriteKeyName);
    });
  });

  test.describe('List API Keys', () => {
    test('should show empty state when no keys exist', async ({ page }) => {
      // This test assumes no keys exist initially
      // Skip if keys already exist
      const keyCount = await apiKeysPage.getKeyCount();
      if (keyCount > 0) {
        test.skip();
        return;
      }

      await apiKeysPage.assertNoKeys();
    });

    test('should display key metadata (name, prefix, last used)', async ({ page }) => {
      const keyName = `Metadata Test ${Date.now()}`;

      await apiKeysPage.createKey(keyName);
      await apiKeysPage.closeNewKeyModal();

      const keyItem = apiKeysPage.getKeyByName(keyName);

      await test.step('Verify key name is displayed', async () => {
        await expect(keyItem.locator('[data-testid="api-key-name"]')).toContainText(keyName);
      });

      await test.step('Verify key prefix is displayed (masked)', async () => {
        // Key prefix is shown like "sk_xxx..."
        await expect(keyItem).toContainText('...');
      });

      // Clean up
      await apiKeysPage.deleteKey(keyName);
    });
  });

  test.describe('Revoke API Key', () => {
    test('should revoke key with confirmation dialog', async ({ page }) => {
      const keyName = `Revoke Test ${Date.now()}`;

      // Create a key first
      await apiKeysPage.createKey(keyName);
      await apiKeysPage.closeNewKeyModal();
      await apiKeysPage.assertKeyExists(keyName);

      await test.step('Revoke the key', async () => {
        await apiKeysPage.deleteKey(keyName);
      });

      await test.step('Verify key is removed from list', async () => {
        await apiKeysPage.assertKeyNotExists(keyName);
      });
    });

    test('should update key count after revocation', async ({ page }) => {
      const keyName = `Count Test ${Date.now()}`;

      await apiKeysPage.createKey(keyName);
      await apiKeysPage.closeNewKeyModal();

      const countBefore = await apiKeysPage.getKeyCount();

      await apiKeysPage.deleteKey(keyName);

      const countAfter = await apiKeysPage.getKeyCount();
      expect(countAfter).toBe(countBefore - 1);
    });
  });

  test.describe('API Key Usage', () => {
    test('should allow API request with valid key', async ({ page, request }) => {
      const keyName = `Usage Test ${Date.now()}`;

      // Create a key
      const apiKey = await apiKeysPage.createKey(keyName, 'READ_ONLY');
      await apiKeysPage.closeNewKeyModal();

      await test.step('Make API request with the key', async () => {
        const response = await request.get('/api/keys', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        expect(response.ok()).toBe(true);
        const data = await response.json();
        expect(data.keys).toBeDefined();
      });

      // Clean up
      await apiKeysPage.deleteKey(keyName);
    });

    test('should reject API request with invalid key', async ({ request }) => {
      await test.step('Make API request with invalid key', async () => {
        const response = await request.get('/api/keys', {
          headers: {
            Authorization: 'Bearer invalid_key_12345',
          },
        });

        expect(response.status()).toBe(401);
      });
    });

    test('should reject API request with revoked key', async ({ page, request }) => {
      const keyName = `Revoked Key Test ${Date.now()}`;

      // Create and capture the key
      const apiKey = await apiKeysPage.createKey(keyName);
      await apiKeysPage.closeNewKeyModal();

      // Verify it works initially
      await test.step('Verify key works before revocation', async () => {
        const response = await request.get('/api/keys', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
        expect(response.ok()).toBe(true);
      });

      // Revoke the key
      await apiKeysPage.deleteKey(keyName);

      // Verify it no longer works
      await test.step('Verify key fails after revocation', async () => {
        const response = await request.get('/api/keys', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
        expect(response.status()).toBe(401);
      });
    });
  });
});
