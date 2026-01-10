import { test, expect } from '@playwright/test';
import { SessionsPage } from '../../pages/SessionsPage';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Sessions Management', () => {
  let sessionsPage: SessionsPage;

  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsUser(page);
    sessionsPage = new SessionsPage(page);
    await sessionsPage.goto();
  });

  test.afterEach(async ({ page }) => {
    try {
      await AuthHelpers.logout(page);
    } catch {
      // Ignore logout errors
    }
  });

  test.describe('View Sessions', () => {
    test('should display sessions card', async () => {
      await expect(sessionsPage.sessionsCard).toBeVisible();
    });

    test('should show empty state when no remember me sessions exist', async ({ page }) => {
      // This test may skip if user has sessions
      const sessionCount = await sessionsPage.getSessionCount();
      if (sessionCount > 0) {
        test.skip();
        return;
      }

      await sessionsPage.assertNoSessions();
    });

    test('should display current device badge for active session', async () => {
      const sessionCount = await sessionsPage.getSessionCount();
      if (sessionCount === 0) {
        test.skip();
        return;
      }

      const hasBadge = await sessionsPage.hasCurrentDeviceBadge();
      expect(hasBadge).toBe(true);
    });

    test('should show session device/browser info', async () => {
      const sessionCount = await sessionsPage.getSessionCount();
      if (sessionCount === 0) {
        test.skip();
        return;
      }

      const sessionItems = sessionsPage.getSessionItems();
      const firstSession = sessionItems.first();
      const deviceInfo = firstSession.locator('[data-testid="session-device-info"]');
      await expect(deviceInfo).toBeVisible();
      const text = await deviceInfo.textContent();
      expect(text).toBeTruthy();
      // Should contain browser/OS pattern like "Chrome on macOS"
      expect(text).toMatch(/\w+ on \w+/);
    });
  });

  test.describe('Revoke Session', () => {
    test('should not show revoke button for current device', async () => {
      const sessionCount = await sessionsPage.getSessionCount();
      if (sessionCount === 0) {
        test.skip();
        return;
      }

      // Find the current device session
      const currentDeviceBadge = sessionsPage.page.locator('[data-testid="current-device-badge"]');
      if (await currentDeviceBadge.isVisible()) {
        // Get the parent session item
        const currentSession = currentDeviceBadge.locator('..').locator('..').locator('..').locator('..');
        // Revoke button should not be in this session
        const revokeButton = currentSession.locator('[data-testid="revoke-session-button"]');
        await expect(revokeButton).not.toBeVisible();
      }
    });

    test('should show revoke button for non-current sessions', async () => {
      const sessionCount = await sessionsPage.getSessionCount();
      if (sessionCount <= 1) {
        test.skip();
        return;
      }

      // Find sessions without the current device badge
      const allSessions = sessionsPage.getSessionItems();
      const count = await allSessions.count();

      for (let i = 0; i < count; i++) {
        const session = allSessions.nth(i);
        const hasBadge = await session.locator('[data-testid="current-device-badge"]').isVisible();
        if (!hasBadge) {
          const revokeButton = session.locator('[data-testid="revoke-session-button"]');
          await expect(revokeButton).toBeVisible();
          break;
        }
      }
    });
  });

  test.describe('Revoke All Sessions', () => {
    test('should show revoke all button when multiple sessions exist', async () => {
      const sessionCount = await sessionsPage.getSessionCount();
      if (sessionCount <= 1) {
        test.skip();
        return;
      }

      await expect(sessionsPage.revokeAllButton).toBeVisible();
      await expect(sessionsPage.revokeAllButton).toContainText('Revoke all other sessions');
    });

    test('should not show revoke all button with single session', async () => {
      const sessionCount = await sessionsPage.getSessionCount();
      if (sessionCount !== 1) {
        test.skip();
        return;
      }

      await expect(sessionsPage.revokeAllButton).not.toBeVisible();
    });
  });
});
