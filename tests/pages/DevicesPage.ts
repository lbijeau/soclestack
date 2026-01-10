import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for Trusted Devices management (/profile/devices)
 */
export class DevicesPage extends BasePage {
  // Main elements
  readonly devicesCard: Locator;
  readonly devicesList: Locator;
  readonly emptyMessage: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    super(page);

    this.devicesCard = this.page.locator('[data-testid="devices-card"]');
    this.devicesList = this.page.locator('[data-testid="devices-list"]');
    this.emptyMessage = this.page.locator('[data-testid="devices-empty-message"]');
    this.errorMessage = this.page.locator('[data-testid="devices-error"]');
    this.successMessage = this.page.locator('[data-testid="devices-success"]');
    this.loadingIndicator = this.page.locator('[data-testid="devices-loading"]');
  }

  /**
   * Navigate to the devices page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/profile/devices');
    await this.page.waitForSelector('[data-testid="devices-card"]', {
      timeout: 10000,
    });
    // Wait for loading to complete
    await expect(this.loadingIndicator).not.toBeVisible({ timeout: 10000 });
  }

  /**
   * Get a device item by ID
   */
  getDeviceById(deviceId: string): Locator {
    return this.page.locator(`[data-device-id="${deviceId}"]`);
  }

  /**
   * Get all device items
   */
  getDeviceItems(): Locator {
    return this.page.locator('[data-testid^="device-item-"]');
  }

  /**
   * Get the current device
   */
  getCurrentDevice(): Locator {
    return this.page.locator('[data-testid="current-device-badge"]').locator('..').locator('..').locator('..');
  }

  /**
   * Get device count
   */
  async getDeviceCount(): Promise<number> {
    const items = this.getDeviceItems();
    return items.count();
  }

  /**
   * Revoke a device by ID
   */
  async revokeDevice(deviceId: string): Promise<void> {
    const deviceItem = this.getDeviceById(deviceId);
    await expect(deviceItem).toBeVisible();
    await deviceItem.locator('[data-testid="revoke-device-button"]').click();
    await expect(deviceItem).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Check if current device badge is visible
   */
  async hasCurrentDeviceBadge(): Promise<boolean> {
    return this.page.locator('[data-testid="current-device-badge"]').isVisible();
  }

  /**
   * Get device name
   */
  async getDeviceName(deviceId: string): Promise<string | null> {
    const deviceItem = this.getDeviceById(deviceId);
    const deviceName = deviceItem.locator('[data-testid="device-name"]');
    return deviceName.textContent();
  }

  /**
   * Get all device names
   */
  async getDeviceNames(): Promise<string[]> {
    const nameElements = this.page.locator('[data-testid="device-name"]');
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
   * Assert that the devices list is empty
   */
  async assertNoDevices(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible();
  }

  /**
   * Assert that devices list has items
   */
  async assertHasDevices(): Promise<void> {
    await expect(this.devicesList).toBeVisible();
    const count = await this.getDeviceCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Assert a device exists by ID
   */
  async assertDeviceExists(deviceId: string): Promise<void> {
    const deviceItem = this.getDeviceById(deviceId);
    await expect(deviceItem).toBeVisible();
  }

  /**
   * Assert a device does not exist
   */
  async assertDeviceNotExists(deviceId: string): Promise<void> {
    const deviceItem = this.getDeviceById(deviceId);
    await expect(deviceItem).not.toBeVisible();
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
   * Assert success message is shown
   */
  async assertSuccess(message?: string): Promise<void> {
    await expect(this.successMessage).toBeVisible();
    if (message) {
      await expect(this.successMessage).toContainText(message);
    }
  }
}
