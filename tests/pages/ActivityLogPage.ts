import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for Activity Log (/profile/activity)
 */
export class ActivityLogPage extends BasePage {
  // Main elements
  readonly activityCard: Locator;
  readonly activityList: Locator;
  readonly emptyMessage: Locator;
  readonly errorMessage: Locator;
  readonly loadingIndicator: Locator;
  readonly pagination: Locator;
  readonly pageInfo: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    super(page);

    this.activityCard = this.page.locator('[data-testid="activity-log-card"]');
    this.activityList = this.page.locator('[data-testid="activity-log-list"]');
    this.emptyMessage = this.page.locator('[data-testid="activity-log-empty"]');
    this.errorMessage = this.page.locator('[data-testid="activity-log-error"]');
    this.loadingIndicator = this.page.locator('[data-testid="activity-log-loading"]');
    this.pagination = this.page.locator('[data-testid="activity-pagination"]');
    this.pageInfo = this.page.locator('[data-testid="activity-page-info"]');
    this.prevButton = this.page.locator('[data-testid="activity-prev-button"]');
    this.nextButton = this.page.locator('[data-testid="activity-next-button"]');
  }

  /**
   * Navigate to the activity log page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/profile/activity');
    await this.page.waitForSelector('[data-testid="activity-log-card"]', {
      timeout: 10000,
    });
    // Wait for loading to complete
    await expect(this.loadingIndicator).not.toBeVisible({ timeout: 10000 });
  }

  /**
   * Get all activity items
   */
  getActivityItems(): Locator {
    return this.page.locator('[data-testid^="activity-item-"]');
  }

  /**
   * Get activity items by action type
   */
  getActivitiesByAction(action: string): Locator {
    return this.page.locator(`[data-activity-action="${action}"]`);
  }

  /**
   * Get activity count
   */
  async getActivityCount(): Promise<number> {
    const items = this.getActivityItems();
    return items.count();
  }

  /**
   * Get activity labels
   */
  async getActivityLabels(): Promise<string[]> {
    const labelElements = this.page.locator('[data-testid="activity-label"]');
    const count = await labelElements.count();
    const labels: string[] = [];

    for (let i = 0; i < count; i++) {
      const label = await labelElements.nth(i).textContent();
      if (label) {
        labels.push(label.trim());
      }
    }

    return labels;
  }

  /**
   * Check if activity with specific action exists
   */
  async hasActivityWithAction(action: string): Promise<boolean> {
    const items = this.getActivitiesByAction(action);
    const count = await items.count();
    return count > 0;
  }

  /**
   * Check if activity with specific label text exists
   */
  async hasActivityWithLabel(labelText: string): Promise<boolean> {
    const labels = await this.getActivityLabels();
    return labels.some(label => label.includes(labelText));
  }

  /**
   * Go to next page
   */
  async goToNextPage(): Promise<void> {
    await expect(this.nextButton).toBeEnabled();
    await this.nextButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Go to previous page
   */
  async goToPreviousPage(): Promise<void> {
    await expect(this.prevButton).toBeEnabled();
    await this.prevButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get current page number from pagination info
   */
  async getCurrentPage(): Promise<number> {
    const pageInfoText = await this.pageInfo.textContent();
    if (!pageInfoText) return 1;
    const match = pageInfoText.match(/Page (\d+) of (\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Get total pages from pagination info
   */
  async getTotalPages(): Promise<number> {
    const pageInfoText = await this.pageInfo.textContent();
    if (!pageInfoText) return 1;
    const match = pageInfoText.match(/Page (\d+) of (\d+)/);
    return match ? parseInt(match[2], 10) : 1;
  }

  /**
   * Check if pagination is visible
   */
  async hasPagination(): Promise<boolean> {
    return this.pagination.isVisible();
  }

  /**
   * Assert that the activity list is empty
   */
  async assertNoActivity(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible();
  }

  /**
   * Assert that activity list has items
   */
  async assertHasActivity(): Promise<void> {
    await expect(this.activityList).toBeVisible();
    const count = await this.getActivityCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Assert error message is shown
   */
  async assertError(message?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  /**
   * Assert next button is disabled (last page)
   */
  async assertOnLastPage(): Promise<void> {
    await expect(this.nextButton).toBeDisabled();
  }

  /**
   * Assert prev button is disabled (first page)
   */
  async assertOnFirstPage(): Promise<void> {
    await expect(this.prevButton).toBeDisabled();
  }
}
