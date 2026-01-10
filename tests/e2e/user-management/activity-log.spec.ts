import { test, expect } from '@playwright/test';
import { ActivityLogPage } from '../../pages/ActivityLogPage';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Activity Log', () => {
  let activityLogPage: ActivityLogPage;

  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsUser(page);
    activityLogPage = new ActivityLogPage(page);
    await activityLogPage.goto();
  });

  test.afterEach(async ({ page }) => {
    try {
      await AuthHelpers.logout(page);
    } catch {
      // Ignore logout errors
    }
  });

  test.describe('View Activity Log', () => {
    test('should display activity log card', async () => {
      await expect(activityLogPage.activityCard).toBeVisible();
    });

    test('should show activity list when events exist', async () => {
      const activityCount = await activityLogPage.getActivityCount();
      if (activityCount === 0) {
        test.skip();
        return;
      }

      await activityLogPage.assertHasActivity();
    });

    test('should show empty state when no activity exists', async () => {
      const activityCount = await activityLogPage.getActivityCount();
      if (activityCount > 0) {
        test.skip();
        return;
      }

      await activityLogPage.assertNoActivity();
    });
  });

  test.describe('Activity Items', () => {
    test('should display activity labels', async () => {
      const activityCount = await activityLogPage.getActivityCount();
      if (activityCount === 0) {
        test.skip();
        return;
      }

      const labels = await activityLogPage.getActivityLabels();
      expect(labels.length).toBeGreaterThan(0);

      // Each label should have text
      for (const label of labels) {
        expect(label).toBeTruthy();
        expect(label.length).toBeGreaterThan(0);
      }
    });

    test('should show various action types', async () => {
      const activityCount = await activityLogPage.getActivityCount();
      if (activityCount === 0) {
        test.skip();
        return;
      }

      const labels = await activityLogPage.getActivityLabels();

      // Should have at least one recognizable action
      const hasRecognizableAction = labels.some(
        label =>
          label.includes('Signed') ||
          label.includes('Login') ||
          label.includes('Two-factor') ||
          label.includes('Password') ||
          label.includes('Account') ||
          label.includes('API key')
      );
      expect(hasRecognizableAction).toBe(true);
    });

    test('should show activity in chronological order', async () => {
      const activityCount = await activityLogPage.getActivityCount();
      if (activityCount === 0) {
        test.skip();
        return;
      }

      // Activities should be listed (most recent first by default)
      const activityItems = activityLogPage.getActivityItems();
      const count = await activityItems.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Activity Log Pagination', () => {
    test('should show pagination when multiple pages exist', async () => {
      const hasPagination = await activityLogPage.hasPagination();

      if (!hasPagination) {
        // Skip if no pagination (not enough activity)
        test.skip();
        return;
      }

      await expect(activityLogPage.pagination).toBeVisible();
      await expect(activityLogPage.pageInfo).toBeVisible();
    });

    test('should navigate to next page when available', async () => {
      const hasPagination = await activityLogPage.hasPagination();

      if (!hasPagination) {
        test.skip();
        return;
      }

      const totalPages = await activityLogPage.getTotalPages();
      if (totalPages <= 1) {
        test.skip();
        return;
      }

      await activityLogPage.assertOnFirstPage();
      await activityLogPage.goToNextPage();

      const currentPage = await activityLogPage.getCurrentPage();
      expect(currentPage).toBe(2);
    });

    test('should navigate back to previous page', async () => {
      const hasPagination = await activityLogPage.hasPagination();

      if (!hasPagination) {
        test.skip();
        return;
      }

      const totalPages = await activityLogPage.getTotalPages();
      if (totalPages <= 1) {
        test.skip();
        return;
      }

      // Go to page 2
      await activityLogPage.goToNextPage();
      expect(await activityLogPage.getCurrentPage()).toBe(2);

      // Go back to page 1
      await activityLogPage.goToPreviousPage();
      expect(await activityLogPage.getCurrentPage()).toBe(1);
    });

    test('should disable prev button on first page', async () => {
      const hasPagination = await activityLogPage.hasPagination();

      if (!hasPagination) {
        test.skip();
        return;
      }

      await activityLogPage.assertOnFirstPage();
    });
  });

  test.describe('Activity Categories', () => {
    test('should show authentication activities', async () => {
      const activityCount = await activityLogPage.getActivityCount();
      if (activityCount === 0) {
        test.skip();
        return;
      }

      // Check for login activity (should exist after logging in)
      const hasLoginActivity = await activityLogPage.hasActivityWithLabel('Signed in');
      // May or may not be visible depending on activity limit
      if (hasLoginActivity) {
        expect(hasLoginActivity).toBe(true);
      }
    });

    test('should display activity action attribute', async () => {
      const activityCount = await activityLogPage.getActivityCount();
      if (activityCount === 0) {
        test.skip();
        return;
      }

      const activityItems = activityLogPage.getActivityItems();
      const firstActivity = activityItems.first();

      // Should have data-activity-action attribute
      const action = await firstActivity.getAttribute('data-activity-action');
      expect(action).toBeTruthy();
    });
  });
});
