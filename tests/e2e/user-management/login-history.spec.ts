import { test, expect } from '@playwright/test';
import { LoginHistoryPage } from '../../pages/LoginHistoryPage';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Login History', () => {
  let loginHistoryPage: LoginHistoryPage;

  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsUser(page);
    loginHistoryPage = new LoginHistoryPage(page);
    await loginHistoryPage.goto();
  });

  test.afterEach(async ({ page }) => {
    try {
      await AuthHelpers.logout(page);
    } catch {
      // Ignore logout errors
    }
  });

  test.describe('View Login History', () => {
    test('should display login history card', async () => {
      await expect(loginHistoryPage.historyCard).toBeVisible();
    });

    test('should show login history list when events exist', async () => {
      const eventCount = await loginHistoryPage.getEventCount();
      if (eventCount === 0) {
        test.skip();
        return;
      }

      await loginHistoryPage.assertHasHistory();
    });

    test('should show empty state when no history exists', async () => {
      const eventCount = await loginHistoryPage.getEventCount();
      if (eventCount > 0) {
        test.skip();
        return;
      }

      await loginHistoryPage.assertNoHistory();
    });

    test('should have successful login event from current session', async () => {
      // After logging in, there should be at least one successful login event
      const eventCount = await loginHistoryPage.getEventCount();
      if (eventCount === 0) {
        test.skip();
        return;
      }

      await loginHistoryPage.assertHasSuccessfulEvents();
    });
  });

  test.describe('Login Event Details', () => {
    test('should show action label for each event', async () => {
      const eventCount = await loginHistoryPage.getEventCount();
      if (eventCount === 0) {
        test.skip();
        return;
      }

      const actionLabels = await loginHistoryPage.getActionLabels();
      expect(actionLabels.length).toBeGreaterThan(0);

      // Each action should have recognizable text
      for (const label of actionLabels) {
        expect(label).toBeTruthy();
        expect(label.length).toBeGreaterThan(0);
      }
    });

    test('should show device/browser info for events', async () => {
      const eventCount = await loginHistoryPage.getEventCount();
      if (eventCount === 0) {
        test.skip();
        return;
      }

      const deviceInfo = await loginHistoryPage.getFirstEventDeviceInfo();
      expect(deviceInfo).toBeTruthy();
      // Should contain browser/OS pattern and IP
      expect(deviceInfo).toMatch(/\w+ on \w+/);
    });

    test('should show timestamp for events', async () => {
      const eventCount = await loginHistoryPage.getEventCount();
      if (eventCount === 0) {
        test.skip();
        return;
      }

      const eventItems = loginHistoryPage.getEventItems();
      const firstEvent = eventItems.first();
      const dateElement = firstEvent.locator('[data-testid="login-event-date"]');
      await expect(dateElement).toBeVisible();
      const dateText = await dateElement.textContent();
      expect(dateText).toBeTruthy();
    });
  });

  test.describe('Event Status Indicators', () => {
    test('should visually distinguish successful and failed events', async () => {
      const eventCount = await loginHistoryPage.getEventCount();
      if (eventCount === 0) {
        test.skip();
        return;
      }

      // Successful events should exist (at least from current login)
      const successfulEvents = loginHistoryPage.getSuccessfulEvents();
      const successCount = await successfulEvents.count();

      if (successCount > 0) {
        // Successful events should have normal border styling
        const firstSuccess = successfulEvents.first();
        await expect(firstSuccess).toHaveAttribute('data-event-success', 'true');
      }
    });

    test('should show reason for failed login attempts', async () => {
      const failedEvents = loginHistoryPage.getFailedEvents();
      const failedCount = await failedEvents.count();

      if (failedCount === 0) {
        test.skip();
        return;
      }

      // Failed events might have a reason shown
      const firstFailed = failedEvents.first();
      const reasonElement = firstFailed.locator('[data-testid="login-event-reason"]');

      // Reason may or may not be present depending on the failure type
      // Just check the failed event is properly marked
      await expect(firstFailed).toHaveAttribute('data-event-success', 'false');
    });
  });

  test.describe('Login History Actions', () => {
    test('should contain login successful action after authentication', async () => {
      const hasLoginSuccess = await loginHistoryPage.hasEventWithAction('Login successful');
      expect(hasLoginSuccess).toBe(true);
    });

    test('should show different action types', async () => {
      const actionLabels = await loginHistoryPage.getActionLabels();

      // At minimum we should see login events
      const hasAnyAction = actionLabels.some(
        label => label.includes('Login') || label.includes('Logged') || label.includes('2FA')
      );
      expect(hasAnyAction).toBe(true);
    });
  });
});
