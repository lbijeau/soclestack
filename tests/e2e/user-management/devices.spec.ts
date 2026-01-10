import { test, expect } from '@playwright/test';
import { DevicesPage } from '../../pages/DevicesPage';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Trusted Devices Management', () => {
  let devicesPage: DevicesPage;

  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsUser(page);
    devicesPage = new DevicesPage(page);
    await devicesPage.goto();
  });

  test.afterEach(async ({ page }) => {
    try {
      await AuthHelpers.logout(page);
    } catch {
      // Ignore logout errors
    }
  });

  test.describe('View Devices', () => {
    test('should display devices card', async () => {
      await expect(devicesPage.devicesCard).toBeVisible();
    });

    test('should show empty state when no trusted devices exist', async () => {
      const deviceCount = await devicesPage.getDeviceCount();
      if (deviceCount > 0) {
        test.skip();
        return;
      }

      await devicesPage.assertNoDevices();
    });

    test('should display device list when devices exist', async () => {
      const deviceCount = await devicesPage.getDeviceCount();
      if (deviceCount === 0) {
        test.skip();
        return;
      }

      await devicesPage.assertHasDevices();
    });

    test('should display current device badge', async () => {
      const deviceCount = await devicesPage.getDeviceCount();
      if (deviceCount === 0) {
        test.skip();
        return;
      }

      const hasBadge = await devicesPage.hasCurrentDeviceBadge();
      expect(hasBadge).toBe(true);
    });

    test('should show device name with browser and OS', async () => {
      const deviceCount = await devicesPage.getDeviceCount();
      if (deviceCount === 0) {
        test.skip();
        return;
      }

      const deviceItems = devicesPage.getDeviceItems();
      const firstDevice = deviceItems.first();
      const deviceName = firstDevice.locator('[data-testid="device-name"]');
      await expect(deviceName).toBeVisible();
      const text = await deviceName.textContent();
      expect(text).toBeTruthy();
      // Should contain browser/OS pattern like "Chrome on macOS"
      expect(text).toMatch(/\w+ on \w+/);
    });
  });

  test.describe('Device Information', () => {
    test('should display device metadata', async () => {
      const deviceCount = await devicesPage.getDeviceCount();
      if (deviceCount === 0) {
        test.skip();
        return;
      }

      const deviceItems = devicesPage.getDeviceItems();
      const firstDevice = deviceItems.first();

      // Should show device name
      const deviceName = firstDevice.locator('[data-testid="device-name"]');
      await expect(deviceName).toBeVisible();

      // Should show IP and last used info
      const deviceText = await firstDevice.textContent();
      expect(deviceText).toBeTruthy();
    });
  });

  test.describe('Revoke Device', () => {
    test('should not show revoke button for current device', async () => {
      const deviceCount = await devicesPage.getDeviceCount();
      if (deviceCount === 0) {
        test.skip();
        return;
      }

      // Find the current device
      const currentDeviceBadge = devicesPage.page.locator('[data-testid="current-device-badge"]');
      if (await currentDeviceBadge.isVisible()) {
        // Get the parent device item
        const currentDevice = devicesPage.getCurrentDevice();
        // Revoke button should not be in this device item
        const revokeButton = currentDevice.locator('[data-testid="revoke-device-button"]');
        await expect(revokeButton).not.toBeVisible();
      }
    });

    test('should show revoke button for non-current devices', async () => {
      const deviceCount = await devicesPage.getDeviceCount();
      if (deviceCount <= 1) {
        test.skip();
        return;
      }

      // Find devices without the current device badge
      const allDevices = devicesPage.getDeviceItems();
      const count = await allDevices.count();

      for (let i = 0; i < count; i++) {
        const device = allDevices.nth(i);
        const hasBadge = await device.locator('[data-testid="current-device-badge"]').isVisible();
        if (!hasBadge) {
          const revokeButton = device.locator('[data-testid="revoke-device-button"]');
          await expect(revokeButton).toBeVisible();
          break;
        }
      }
    });
  });
});
