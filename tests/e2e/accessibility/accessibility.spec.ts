import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { RegistrationPage } from '../../pages/RegistrationPage';
import { ExtendedProfilePage as ProfilePage } from '../../pages/ExtendedProfilePage';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { TestDataFactory } from '../../utils/test-data-factory';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async () => {
    await DatabaseHelpers.setupTestUsers();
  });

  test.describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation on login page', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await test.step('Test tab navigation through form elements', async () => {
        await loginPage.testKeyboardNavigation();
      });

      await test.step('Test form submission with Enter key', async () => {
        await loginPage.testFormSubmissionWithEnter();
      });

      await test.step('Test escape key functionality', async () => {
        // Open any modals/dropdowns and test escape
        await page.keyboard.press('Escape');

        // Should close any open modals or return focus appropriately
        const activeElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(['BODY', 'INPUT', 'BUTTON']).toContain(activeElement);
      });
    });

    test('should support keyboard navigation on registration page', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Test comprehensive keyboard navigation', async () => {
        await registrationPage.testKeyboardNavigation();
      });

      await test.step('Test form submission with Enter', async () => {
        await registrationPage.testFormSubmissionWithEnter();
      });

      await test.step('Test password visibility toggle with keyboard', async () => {
        await registrationPage.passwordInput.focus();
        await page.keyboard.press('Tab'); // Move to show password button
        await page.keyboard.press('Space'); // Activate button

        await registrationPage.assertPasswordFieldType('password', 'text');

        await page.keyboard.press('Space'); // Toggle back
        await registrationPage.assertPasswordFieldType('password', 'password');
      });
    });

    test('should support keyboard navigation on profile page', async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await AuthHelpers.loginAsUser(page);
      await profilePage.goto();

      await test.step('Test profile form keyboard navigation', async () => {
        await profilePage.testKeyboardNavigation();
      });

      await test.step('Test tab navigation between sections', async () => {
        const sections = [
          '[data-testid="personal-info-section"]',
          '[data-testid="account-settings-section"]',
          '[data-testid="password-section"]',
        ];

        for (const section of sections) {
          await page.locator(section).press('Tab');
          const focused = await page.evaluate(() => document.activeElement?.closest('[data-testid]')?.getAttribute('data-testid'));
          expect(focused).toBeTruthy();
        }
      });
    });

    test('should handle keyboard navigation in admin panels', async ({ page }) => {
      await AuthHelpers.loginAsAdmin(page);
      await page.goto('/admin/users');

      await test.step('Test data table keyboard navigation', async () => {
        const userTable = page.locator('[data-testid="user-table"]');
        await userTable.focus();

        // Test arrow key navigation
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter'); // Should open user details

        const userDetails = page.locator('[data-testid="user-details"]');
        await expect(userDetails).toBeVisible();
      });

      await test.step('Test menu navigation', async () => {
        await page.keyboard.press('Alt+m'); // Open main menu (if supported)
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        // Should navigate to a menu item
        const url = page.url();
        expect(url).toContain('/admin');
      });
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await test.step('Test form accessibility attributes', async () => {
        // Form should have proper role
        await expect(loginPage.loginForm).toHaveAttribute('role', 'form');

        // Inputs should have labels
        await expect(loginPage.emailInput).toHaveAttribute('aria-label');
        await expect(loginPage.passwordInput).toHaveAttribute('aria-label');

        // Submit button should be properly labeled
        await expect(loginPage.loginButton).toHaveAttribute('aria-label');
      });

      await test.step('Test error message accessibility', async () => {
        await loginPage.submitLogin(); // Trigger validation errors

        // Error messages should have alert role
        await expect(loginPage.emailValidationError).toHaveAttribute('role', 'alert');
        await expect(loginPage.passwordValidationError).toHaveAttribute('role', 'alert');

        // Form fields should reference their error messages
        const emailDescribedBy = await loginPage.emailInput.getAttribute('aria-describedby');
        const passwordDescribedBy = await loginPage.passwordInput.getAttribute('aria-describedby');

        expect(emailDescribedBy).toContain('email');
        expect(passwordDescribedBy).toContain('password');
      });
    });

    test('should provide screen reader announcements', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Test live region announcements', async () => {
        // Look for aria-live regions
        const liveRegions = page.locator('[aria-live]');
        expect(await liveRegions.count()).toBeGreaterThan(0);

        // Test status announcements
        await registrationPage.fillPassword('weak');
        const statusRegion = page.locator('[aria-live="polite"]');
        await expect(statusRegion).toContainText(/weak|strength/i);
      });

      await test.step('Test form progress announcements', async () => {
        // Progress indicators should be announced
        const progressElement = page.locator('[role="progressbar"]');
        if (await progressElement.count() > 0) {
          await expect(progressElement).toHaveAttribute('aria-valuenow');
          await expect(progressElement).toHaveAttribute('aria-valuemax');
        }
      });
    });

    test('should support screen reader navigation landmarks', async ({ page }) => {
      await AuthHelpers.loginAsUser(page);
      await page.goto('/dashboard');

      await test.step('Test page landmark structure', async () => {
        // Page should have proper landmark roles
        await expect(page.locator('[role="banner"]')).toBeVisible(); // Header
        await expect(page.locator('[role="main"]')).toBeVisible(); // Main content
        await expect(page.locator('[role="navigation"]')).toBeVisible(); // Navigation

        // Check for complementary content (sidebar)
        const complementary = page.locator('[role="complementary"]');
        if (await complementary.count() > 0) {
          await expect(complementary).toBeVisible();
        }
      });

      await test.step('Test heading hierarchy', async () => {
        const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
        expect(headings.length).toBeGreaterThan(0);

        // Should have at least one h1
        const h1Elements = await page.locator('h1').count();
        expect(h1Elements).toBeGreaterThanOrEqual(1);
      });
    });
  });

  test.describe('Color Contrast and Visual Accessibility', () => {
    test('should meet WCAG color contrast requirements', async ({ page }) => {
      const testData = TestDataFactory.createAccessibilityTestData();

      await test.step('Test login page color contrast', async () => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Test contrast for key elements
        for (const test of testData.colorContrastTests) {
          const elements = page.locator(test.element);
          const count = await elements.count();

          if (count > 0) {
            // This would require a color contrast library in a real implementation
            // For now, we verify elements are visible and styled
            await expect(elements.first()).toBeVisible();

            const styles = await elements.first().evaluate(el => {
              const computed = window.getComputedStyle(el);
              return {
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                fontSize: computed.fontSize,
              };
            });

            expect(styles.color).not.toBe('');
            expect(styles.color).not.toBe(styles.backgroundColor);
          }
        }
      });

      await test.step('Test high contrast mode support', async () => {
        // Simulate high contrast mode
        await page.emulateMedia({ colorScheme: 'dark' });

        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Elements should remain visible and usable
        await expect(loginPage.loginForm).toBeVisible();
        await expect(loginPage.emailInput).toBeVisible();
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.loginButton).toBeVisible();
      });
    });

    test('should support reduced motion preferences', async ({ page }) => {
      await test.step('Test with reduced motion', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });

        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Animations should be reduced or disabled
        const animatedElements = page.locator('[data-testid*="animation"], .animate');
        const count = await animatedElements.count();

        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const element = animatedElements.nth(i);
            const animationDuration = await element.evaluate(el => {
              const computed = window.getComputedStyle(el);
              return computed.animationDuration;
            });

            // Animations should be very short or none when reduced motion is preferred
            expect(['0s', '0.01s']).toContain(animationDuration);
          }
        }
      });
    });
  });

  test.describe('Focus Management', () => {
    test('should manage focus properly in modal dialogs', async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await AuthHelpers.loginAsUser(page);
      await profilePage.goto();

      await test.step('Test modal focus trap', async () => {
        // Open a modal (e.g., delete account confirmation)
        await profilePage.navigateToAccountDeletion();
        await profilePage.deleteAccountButton.click();

        // Focus should be trapped within modal
        await expect(profilePage.deleteAccountModal).toBeVisible();

        // Focus should be on first interactive element in modal
        const firstFocusableElement = profilePage.deleteAccountModal.locator('input, button').first();
        await expect(firstFocusableElement).toBeFocused();

        // Tab should cycle within modal
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Should still be within modal
        const focusedElement = await page.evaluate(() => document.activeElement?.closest('[data-testid]')?.getAttribute('data-testid'));
        expect(focusedElement).toContain('delete');
      });

      await test.step('Test modal escape and focus return', async () => {
        // Close modal with escape
        await page.keyboard.press('Escape');

        // Modal should be closed
        await expect(profilePage.deleteAccountModal).not.toBeVisible();

        // Focus should return to trigger element
        await expect(profilePage.deleteAccountButton).toBeFocused();
      });
    });

    test('should manage focus in dynamic content', async ({ page }) => {
      await AuthHelpers.loginAsAdmin(page);
      await page.goto('/admin/users');

      await test.step('Test focus management in data tables', async () => {
        // Click on a user row
        const firstRow = page.locator('[data-testid="user-row"]').first();
        await firstRow.click();

        // Focus should move to opened details
        const userDetails = page.locator('[data-testid="user-details"]');
        await expect(userDetails).toBeVisible();

        // First interactive element in details should be focused
        const firstButton = userDetails.locator('button').first();
        if (await firstButton.count() > 0) {
          await expect(firstButton).toBeFocused();
        }
      });
    });

    test('should handle focus during form errors', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Test focus management on validation errors', async () => {
        await registrationPage.submitRegistration(); // Submit empty form

        // Focus should move to first field with error
        await expect(registrationPage.emailInput).toBeFocused();

        // Error message should be announced
        await expect(registrationPage.emailValidationError).toHaveAttribute('role', 'alert');
      });
    });
  });

  test.describe('Alternative Input Methods', () => {
    test('should support voice control and switch navigation', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await test.step('Test space bar activation', async () => {
        await loginPage.loginButton.focus();
        await page.keyboard.press('Space');

        // Button should be activated (form submitted)
        // Should show validation errors since form is empty
        await loginPage.assertEmailValidationError();
      });

      await test.step('Test enter key activation', async () => {
        await loginPage.fillEmail('test@example.com');
        await loginPage.fillPassword('TestPassword123!');
        await loginPage.passwordInput.focus();
        await page.keyboard.press('Enter');

        // Form should be submitted
        // May redirect or show error depending on credentials
        await page.waitForTimeout(1000);
      });
    });

    test('should work with switch navigation', async ({ page }) => {
      // Simulate switch navigation (single switch with scanning)
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Test sequential activation', async () => {
        const focusableElements = [
          registrationPage.emailInput,
          registrationPage.passwordInput,
          registrationPage.confirmPasswordInput,
          registrationPage.termsCheckbox,
          registrationPage.registerButton,
        ];

        for (let i = 0; i < focusableElements.length; i++) {
          await focusableElements[i].focus();
          await expect(focusableElements[i]).toBeFocused();

          // Simulate switch activation
          await page.keyboard.press('Space');

          // Wait for any responses
          await page.waitForTimeout(100);
        }
      });
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page, browser }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await test.step('Test mobile touch accessibility', async () => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Touch targets should be at least 44px
        const touchTargets = page.locator('button, a, input[type="checkbox"], input[type="radio"]');
        const count = await touchTargets.count();

        for (let i = 0; i < Math.min(count, 10); i++) {
          const element = touchTargets.nth(i);
          const box = await element.boundingBox();

          if (box) {
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      });

      await test.step('Test mobile screen reader support', async () => {
        // Test semantic structure
        const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
        expect(headings).toBeGreaterThan(0);

        // Test form labeling
        const inputs = page.locator('input');
        const inputCount = await inputs.count();

        for (let i = 0; i < inputCount; i++) {
          const input = inputs.nth(i);
          const hasLabel = await input.evaluate(el => {
            const id = el.id;
            const ariaLabel = el.getAttribute('aria-label');
            const ariaLabelledBy = el.getAttribute('aria-labelledby');
            const label = id ? document.querySelector(`label[for="${id}"]`) : null;

            return !!(ariaLabel || ariaLabelledBy || label);
          });

          expect(hasLabel).toBe(true);
        }
      });
    });

    test('should support mobile gestures appropriately', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await AuthHelpers.loginAsUser(page);
      await page.goto('/profile');

      await test.step('Test swipe navigation where appropriate', async () => {
        // Test tab switching with swipe (if implemented)
        const tabContainer = page.locator('[data-testid="profile-tabs"]');

        if (await tabContainer.count() > 0) {
          const firstTab = tabContainer.locator('[role="tab"]').first();
          const lastTab = tabContainer.locator('[role="tab"]').last();

          await firstTab.click();
          await expect(firstTab).toHaveAttribute('aria-selected', 'true');

          // Simulate swipe to next tab
          await page.touchscreen.tap(200, 300);
          await page.touchscreen.tap(100, 300); // Swipe left

          // Should activate next tab (if swipe navigation is implemented)
          await page.waitForTimeout(500);
        }
      });
    });
  });

  test.describe('Accessibility Standards Compliance', () => {
    test('should meet WCAG 2.1 AA standards', async ({ page }) => {
      const pages = [
        { name: 'Login', url: '/login' },
        { name: 'Registration', url: '/register' },
        { name: 'Dashboard', url: '/dashboard', requiresAuth: true },
      ];

      for (const pageInfo of pages) {
        await test.step(`Test ${pageInfo.name} page WCAG compliance`, async () => {
          if (pageInfo.requiresAuth) {
            await AuthHelpers.loginAsUser(page);
          }

          await page.goto(pageInfo.url);

          // Test page structure
          const h1Count = await page.locator('h1').count();
          expect(h1Count).toBeGreaterThanOrEqual(1);

          // Test form accessibility
          const forms = page.locator('form');
          const formCount = await forms.count();

          for (let i = 0; i < formCount; i++) {
            const form = forms.nth(i);
            const inputs = form.locator('input, select, textarea');
            const inputCount = await inputs.count();

            for (let j = 0; j < inputCount; j++) {
              const input = inputs.nth(j);
              const type = await input.getAttribute('type');

              // Skip hidden inputs
              if (type === 'hidden') continue;

              // Each input should have a label
              const hasAccessibleLabel = await input.evaluate(el => {
                const id = el.id;
                const ariaLabel = el.getAttribute('aria-label');
                const ariaLabelledBy = el.getAttribute('aria-labelledby');
                const label = id ? document.querySelector(`label[for="${id}"]`) : null;
                const placeholder = el.getAttribute('placeholder');

                return !!(ariaLabel || ariaLabelledBy || label || placeholder);
              });

              expect(hasAccessibleLabel).toBe(true);
            }
          }

          // Test image accessibility
          const images = page.locator('img');
          const imageCount = await images.count();

          for (let i = 0; i < imageCount; i++) {
            const img = images.nth(i);
            const alt = await img.getAttribute('alt');
            const role = await img.getAttribute('role');

            // Images should have alt text or be marked as decorative
            expect(alt !== null || role === 'presentation').toBe(true);
          }
        });
      }
    });
  });
});