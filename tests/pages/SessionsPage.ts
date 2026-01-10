import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for Sessions management (/profile/sessions)
 */
export class SessionsPage extends BasePage {
  // Main elements
  readonly sessionsCard: Locator;
  readonly sessionsList: Locator;
  readonly emptyMessage: Locator;
  readonly errorMessage: Locator;
  readonly revokeAllButton: Locator;

  constructor(page: Page) {
    super(page);

    this.sessionsCard = this.page.locator('[data-testid="sessions-card"]');
    this.sessionsList = this.page.locator('[data-testid="sessions-list"]');
    this.emptyMessage = this.page.locator('[data-testid="sessions-empty-message"]');
    this.errorMessage = this.page.locator('[data-testid="sessions-error"]');
    this.revokeAllButton = this.page.locator('[data-testid="revoke-all-sessions-button"]');
  }

  /**
   * Navigate to the sessions page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/profile/sessions');
    await this.page.waitForSelector('[data-testid="sessions-card"]', {
      timeout: 10000,
    });
  }

  /**
   * Get a session item by series
   */
  getSessionBySeries(series: string): Locator {
    return this.page.locator(`[data-session-series="${series}"]`);
  }

  /**
   * Get all session items
   */
  getSessionItems(): Locator {
    return this.page.locator('[data-testid^="session-item-"]');
  }

  /**
   * Get the current device session
   */
  getCurrentDeviceSession(): Locator {
    return this.page.locator('[data-testid="current-device-badge"]').locator('..');
  }

  /**
   * Get session count
   */
  async getSessionCount(): Promise<number> {
    const items = this.getSessionItems();
    return items.count();
  }

  /**
   * Revoke a specific session by series
   */
  async revokeSession(series: string): Promise<void> {
    const sessionItem = this.getSessionBySeries(series);
    await expect(sessionItem).toBeVisible();
    await sessionItem.locator('[data-testid="revoke-session-button"]').click();
    await expect(sessionItem).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Revoke all other sessions
   */
  async revokeAllSessions(): Promise<void> {
    await expect(this.revokeAllButton).toBeVisible();
    await this.revokeAllButton.click();
  }

  /**
   * Check if current device badge is visible
   */
  async hasCurrentDeviceBadge(): Promise<boolean> {
    return this.page.locator('[data-testid="current-device-badge"]').isVisible();
  }

  /**
   * Get device info for a session
   */
  async getSessionDeviceInfo(series: string): Promise<string | null> {
    const sessionItem = this.getSessionBySeries(series);
    const deviceInfo = sessionItem.locator('[data-testid="session-device-info"]');
    return deviceInfo.textContent();
  }

  /**
   * Assert that the sessions list is empty
   */
  async assertNoSessions(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible();
  }

  /**
   * Assert that sessions list has items
   */
  async assertHasSessions(): Promise<void> {
    await expect(this.sessionsList).toBeVisible();
    const count = await this.getSessionCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Assert a session exists by series
   */
  async assertSessionExists(series: string): Promise<void> {
    const sessionItem = this.getSessionBySeries(series);
    await expect(sessionItem).toBeVisible();
  }

  /**
   * Assert a session does not exist
   */
  async assertSessionNotExists(series: string): Promise<void> {
    const sessionItem = this.getSessionBySeries(series);
    await expect(sessionItem).not.toBeVisible();
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
