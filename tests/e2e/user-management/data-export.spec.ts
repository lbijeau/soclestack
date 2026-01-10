import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Data Export', () => {
  test.describe('Export Data Card', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');

      // Navigate to profile page where export data card is displayed
      await page.goto('/profile');
    });

    test('should display export data card', async ({ page }) => {
      await expect(page.locator('[data-testid="export-data-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-data-title"]')).toContainText(
        'Export Your Data'
      );
    });

    test('should display export description', async ({ page }) => {
      await expect(page.locator('[data-testid="export-data-description"]')).toContainText(
        'Download a copy of all your personal data'
      );
    });

    test('should display download button', async ({ page }) => {
      const exportButton = page.locator('[data-testid="export-data-button"]');
      await expect(exportButton).toBeVisible();
      await expect(exportButton).toContainText('Download My Data');
    });

    test('should list data included in export', async ({ page }) => {
      const exportCard = page.locator('[data-testid="export-data-card"]');

      // Check that export includes expected data categories
      await expect(exportCard).toContainText('Profile information');
      await expect(exportCard).toContainText('OAuth accounts');
      await expect(exportCard).toContainText('API keys');
      await expect(exportCard).toContainText('sessions');
      await expect(exportCard).toContainText('Activity logs');
    });

    test('should mention rate limiting', async ({ page }) => {
      const exportCard = page.locator('[data-testid="export-data-card"]');
      await expect(exportCard).toContainText('3 exports per day');
    });

    test('should mention export format', async ({ page }) => {
      const exportCard = page.locator('[data-testid="export-data-card"]');
      await expect(exportCard).toContainText('JSON format');
    });
  });

  test.describe('Export Functionality', () => {
    test.skip('should initiate export when button clicked', async ({ page }) => {
      // This test requires proper authentication setup
      // The export button triggers a download which is difficult to test in e2e
    });

    test.skip('should show success message after export', async ({ page }) => {
      // This test requires proper authentication setup and download handling
    });

    test.skip('should handle export errors gracefully', async ({ page }) => {
      // This test requires mocking API errors
    });

    test.skip('should respect rate limiting', async ({ page }) => {
      // This test requires triggering multiple exports
    });
  });

  test.describe('Security', () => {
    test('should require authentication to access export', async ({ page }) => {
      // Navigate directly to profile without login
      await page.goto('/profile');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    });

    test.skip('should not include sensitive data like passwords', async ({ page }) => {
      // This test would need to download and parse the export file
    });
  });
});
