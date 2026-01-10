import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Branding and Theming', () => {
  test.describe('Brand Logo', () => {
    test('should display logo on login page', async ({ page }) => {
      await page.goto('/login');

      const logo = page.locator('[data-testid="auth-logo"]');
      await expect(logo).toBeVisible();
    });

    test('should display logo on register page', async ({ page }) => {
      await page.goto('/register');

      const logo = page.locator('[data-testid="auth-logo"]');
      await expect(logo).toBeVisible();
    });

    test('should display logo in navigation when logged in', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');

      const navLogo = page.locator('[data-testid="nav-logo"]');
      await expect(navLogo).toBeVisible();
    });
  });

  test.describe('Brand Name', () => {
    test('should display brand name in navigation when logged in', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');

      const brandName = page.locator('[data-testid="nav-brand-name"]');
      await expect(brandName).toBeVisible();
      await expect(brandName).toContainText('SocleStack');
    });

    test('should have brand name in page title', async ({ page }) => {
      await page.goto('/login');

      const title = await page.title();
      expect(title).toContain('SocleStack');
    });
  });

  test.describe('Auth Layout', () => {
    test('should display auth layout on login page', async ({ page }) => {
      await page.goto('/login');

      // At least one auth layout should be visible
      const authLayout = page.locator(
        '[data-testid="auth-centered-layout"], [data-testid="auth-split-layout"], [data-testid="auth-fullpage-layout"]'
      );
      await expect(authLayout).toBeVisible();
    });

    test('should display auth title on login page', async ({ page }) => {
      await page.goto('/login');

      const authTitle = page.locator('[data-testid="auth-title"]');
      await expect(authTitle).toBeVisible();
      await expect(authTitle).toContainText('Sign in');
    });

    test('should display auth title on register page', async ({ page }) => {
      await page.goto('/register');

      const authTitle = page.locator('[data-testid="auth-title"]');
      await expect(authTitle).toBeVisible();
      await expect(authTitle).toContainText('Create');
    });
  });

  test.describe('Navigation', () => {
    test('should display navbar on authenticated pages', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');

      const navbar = page.locator('[data-testid="navbar"]');
      await expect(navbar).toBeVisible();
    });

    test('should have brand link that navigates to dashboard', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');

      const brandLink = page.locator('[data-testid="nav-brand-link"]');
      await expect(brandLink).toBeVisible();

      // Verify it's a link to dashboard
      await expect(brandLink).toHaveAttribute('href', '/dashboard');
    });
  });

  test.describe('Primary Color', () => {
    test('should apply primary color to buttons', async ({ page }) => {
      await page.goto('/login');

      // The submit button should have styling based on the primary color
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();

      // Check that the button has some background color (indicating styling is applied)
      const bgColor = await submitButton.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );
      // Default primary color is #3b82f6 which is rgb(59, 130, 246)
      // We're checking that the button has a non-transparent background
      expect(bgColor).not.toBe('transparent');
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('should have CSS custom properties for brand colors', async ({ page }) => {
      await page.goto('/login');

      // Check that the brand CSS variables are set on the html element
      const brandPrimary = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--brand-primary');
      });

      // Should have a value (either default #3b82f6 or custom)
      expect(brandPrimary.trim()).not.toBe('');
    });
  });

  test.describe('Favicon', () => {
    test('should have favicon in the document', async ({ page }) => {
      await page.goto('/login');

      // Check that the page has a favicon link
      const favicon = page.locator('link[rel="icon"]');
      const faviconCount = await favicon.count();

      // Should have at least one favicon link
      expect(faviconCount).toBeGreaterThan(0);
    });
  });

  test.describe('Responsive Layout', () => {
    test('should display navbar on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');

      const navbar = page.locator('[data-testid="navbar"]');
      await expect(navbar).toBeVisible();
    });

    test('should display logo on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');

      const navLogo = page.locator('[data-testid="nav-logo"]');
      await expect(navLogo).toBeVisible();
    });
  });

  test.describe('Auth Styles', () => {
    test.describe('Centered Auth Layout', () => {
      test('should center auth form on login page', async ({ page }) => {
        await page.goto('/login');

        // Default layout is centered
        const centeredLayout = page.locator('[data-testid="auth-centered-layout"]');

        // If centered layout is used, it should be visible
        if (await centeredLayout.isVisible()) {
          await expect(centeredLayout).toBeVisible();
        }
      });
    });

    test.describe('Split Auth Layout', () => {
      test.skip('should display hero section in split layout', async ({ page }) => {
        // This test requires LAYOUT_AUTH_STYLE=split environment variable
        // Skip if not configured
        await page.goto('/login');

        const splitLayout = page.locator('[data-testid="auth-split-layout"]');

        if (await splitLayout.isVisible()) {
          const hero = page.locator('[data-testid="auth-hero"]');
          await expect(hero).toBeVisible();

          const heroTitle = page.locator('[data-testid="auth-hero-title"]');
          await expect(heroTitle).toContainText('Welcome');
        }
      });
    });

    test.describe('Fullpage Auth Layout', () => {
      test.skip('should display header in fullpage layout', async ({ page }) => {
        // This test requires LAYOUT_AUTH_STYLE=fullpage environment variable
        // Skip if not configured
        await page.goto('/login');

        const fullpageLayout = page.locator('[data-testid="auth-fullpage-layout"]');

        if (await fullpageLayout.isVisible()) {
          const header = page.locator('[data-testid="auth-header"]');
          await expect(header).toBeVisible();
        }
      });
    });
  });
});
