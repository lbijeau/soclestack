import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for Login History (/profile/login-history)
 */
export class LoginHistoryPage extends BasePage {
  // Main elements
  readonly historyCard: Locator;
  readonly historyList: Locator;
  readonly emptyMessage: Locator;
  readonly errorMessage: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    super(page);

    this.historyCard = this.page.locator('[data-testid="login-history-card"]');
    this.historyList = this.page.locator('[data-testid="login-history-list"]');
    this.emptyMessage = this.page.locator('[data-testid="login-history-empty"]');
    this.errorMessage = this.page.locator('[data-testid="login-history-error"]');
    this.loadingIndicator = this.page.locator('[data-testid="login-history-loading"]');
  }

  /**
   * Navigate to the login history page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/profile/login-history');
    await this.page.waitForSelector('[data-testid="login-history-card"]', {
      timeout: 10000,
    });
    // Wait for loading to complete
    await expect(this.loadingIndicator).not.toBeVisible({ timeout: 10000 });
  }

  /**
   * Get all login event items
   */
  getEventItems(): Locator {
    return this.page.locator('[data-testid^="login-event-"]');
  }

  /**
   * Get successful login events
   */
  getSuccessfulEvents(): Locator {
    return this.page.locator('[data-event-success="true"]');
  }

  /**
   * Get failed login events
   */
  getFailedEvents(): Locator {
    return this.page.locator('[data-event-success="false"]');
  }

  /**
   * Get event count
   */
  async getEventCount(): Promise<number> {
    const items = this.getEventItems();
    return items.count();
  }

  /**
   * Get successful event count
   */
  async getSuccessfulEventCount(): Promise<number> {
    const items = this.getSuccessfulEvents();
    return items.count();
  }

  /**
   * Get failed event count
   */
  async getFailedEventCount(): Promise<number> {
    const items = this.getFailedEvents();
    return items.count();
  }

  /**
   * Get action labels from all events
   */
  async getActionLabels(): Promise<string[]> {
    const actionElements = this.page.locator('[data-testid="login-event-action"]');
    const count = await actionElements.count();
    const labels: string[] = [];

    for (let i = 0; i < count; i++) {
      const label = await actionElements.nth(i).textContent();
      if (label) {
        labels.push(label.trim());
      }
    }

    return labels;
  }

  /**
   * Check if an event contains specific text
   */
  async hasEventWithAction(actionText: string): Promise<boolean> {
    const actions = await this.getActionLabels();
    return actions.some(action => action.includes(actionText));
  }

  /**
   * Get the first event's device info
   */
  async getFirstEventDeviceInfo(): Promise<string | null> {
    const deviceInfo = this.page.locator('[data-testid="login-event-device"]').first();
    return deviceInfo.textContent();
  }

  /**
   * Assert that the history list is empty
   */
  async assertNoHistory(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible();
  }

  /**
   * Assert that history list has items
   */
  async assertHasHistory(): Promise<void> {
    await expect(this.historyList).toBeVisible();
    const count = await this.getEventCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Assert there are failed login events
   */
  async assertHasFailedEvents(): Promise<void> {
    const count = await this.getFailedEventCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Assert there are successful login events
   */
  async assertHasSuccessfulEvents(): Promise<void> {
    const count = await this.getSuccessfulEventCount();
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
}
