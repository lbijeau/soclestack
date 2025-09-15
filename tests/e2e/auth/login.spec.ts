import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { ProfilePage } from '../../pages/ProfilePage';
import { faker } from '@faker-js/faker';

test.describe('User Login', () => {
  let loginPage: LoginPage;
  let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    profilePage = new ProfilePage(page);
    await loginPage.goto();
  });

  test.describe('Login Form Display', () => {
    test('should display all login form elements', async () => {
      await loginPage.assertLoginFormVisible();
      await expect(loginPage.forgotPasswordLink).toBeVisible();
      await expect(loginPage.registerLink).toBeVisible();
    });

    test('should display social login options', async () => {
      await loginPage.assertSocialLoginVisible();
    });

    test('should have proper form accessibility attributes', async () => {
      await expect(loginPage.loginForm).toHaveAttribute('role', 'form');
      await expect(loginPage.emailInput).toHaveAttribute('type', 'email');
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
      await expect(loginPage.emailInput).toHaveAttribute('autocomplete', 'email');
      await expect(loginPage.passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });

    test('should have proper labels associated with inputs', async () => {
      // Check that inputs have associated labels
      const emailId = await loginPage.emailInput.getAttribute('id');
      const passwordId = await loginPage.passwordInput.getAttribute('id');

      await expect(loginPage.page.locator(`label[for="${emailId}"]`)).toBeVisible();
      await expect(loginPage.page.locator(`label[for="${passwordId}"]`)).toBeVisible();
    });
  });

  test.describe('Successful Login', () => {
    test('should successfully login with valid credentials', async () => {
      await loginPage.login('user@test.com', 'UserTest123!');
      await expect(loginPage.page).toHaveURL(/.*\/dashboard/);

      // Verify user is logged in by checking for user menu
      await expect(loginPage.userMenu).toBeVisible();
    });

    test('should successfully login admin user', async () => {
      await loginPage.login('admin@test.com', 'AdminTest123!');
      await expect(loginPage.page).toHaveURL(/.*\/admin/);

      // Verify admin navigation is visible
      await expect(loginPage.page.locator('[data-testid="admin-navigation"]')).toBeVisible();
    });

    test('should handle "Remember Me" functionality', async () => {
      await loginPage.login('user@test.com', 'UserTest123!', true);
      await expect(loginPage.page).toHaveURL(/.*\/dashboard/);

      // Verify remember me cookie is set
      const cookies = await loginPage.page.context().cookies();
      const rememberMeCookie = cookies.find(cookie => cookie.name === 'remember_me');
      expect(rememberMeCookie).toBeTruthy();
      expect(rememberMeCookie?.httpOnly).toBe(true);
    });

    test('should maintain session after page refresh', async () => {
      await loginPage.login('user@test.com', 'UserTest123!');
      await expect(loginPage.page).toHaveURL(/.*\/dashboard/);

      // Refresh page
      await loginPage.page.reload();

      // Should still be logged in
      await expect(loginPage.page).toHaveURL(/.*\/dashboard/);
      await expect(loginPage.userMenu).toBeVisible();
    });

    test('should redirect to intended page after login', async () => {
      // Navigate to protected page first
      await loginPage.page.goto('/profile');
      await expect(loginPage.page).toHaveURL(/.*\/login\?redirect=.*profile/);

      await loginPage.login('user@test.com', 'UserTest123!');

      // Should redirect to profile page
      await expect(loginPage.page).toHaveURL(/.*\/profile/);
    });
  });

  test.describe('Failed Login Attempts', () => {
    test('should show error for invalid credentials', async () => {
      await loginPage.login('invalid@test.com', 'wrongpassword');
      await loginPage.assertErrorMessage('Invalid email or password');

      // Should remain on login page
      await expect(loginPage.page).toHaveURL(/.*\/login/);
    });

    test('should show error for non-existent user', async () => {
      const nonExistentEmail = `nonexistent.${Date.now()}@test.com`;
      await loginPage.login(nonExistentEmail, 'somepassword');
      await loginPage.assertErrorMessage('Invalid email or password');
    });

    test('should show error for unverified user', async () => {
      await loginPage.login('unverified@test.com', 'UnverifiedTest123!');
      await loginPage.assertErrorMessage('Please verify your email address before logging in');

      // Should show resend verification link
      await expect(loginPage.page.locator('[data-testid="resend-verification-link"]')).toBeVisible();
    });

    test('should handle account locked scenarios', async () => {
      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await loginPage.login('user@test.com', 'wrongpassword');
        await loginPage.assertErrorMessage();
        if (i < 4) {
          // Clear form for next attempt
          await loginPage.fillEmail('user@test.com');
          await loginPage.fillPassword('wrongpassword');
        }
      }

      // Account should be temporarily locked
      await loginPage.assertErrorMessage('Account temporarily locked due to too many failed attempts');

      // Login button should be disabled
      await loginPage.assertLoginButtonDisabled();
    });

    test('should show specific error for suspended account', async () => {
      await loginPage.login('suspended@test.com', 'SuspendedTest123!');
      await loginPage.assertErrorMessage('Your account has been suspended. Please contact support.');
    });
  });

  test.describe('Form Validation', () => {
    test('should validate required fields', async () => {
      await loginPage.submitLogin();

      await loginPage.assertEmailValidationError('Email is required');
      await loginPage.assertPasswordValidationError('Password is required');
      await loginPage.assertLoginButtonDisabled();
    });

    test('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        'invalid@',
        '@invalid.com',
        'invalid@.com'
      ];

      for (const email of invalidEmails) {
        await loginPage.fillEmail(email);
        await loginPage.fillPassword('somepassword');
        await loginPage.submitLogin();

        await loginPage.assertEmailValidationError('Please enter a valid email address');

        // Clear for next iteration
        await loginPage.fillEmail('');
        await loginPage.fillPassword('');
      }
    });

    test('should enforce minimum password length', async () => {
      await loginPage.fillEmail('test@example.com');
      await loginPage.fillPassword('123');
      await loginPage.submitLogin();

      await loginPage.assertPasswordValidationError('Password must be at least 8 characters');
    });

    test('should enable submit button when form is valid', async () => {
      await loginPage.assertLoginButtonDisabled();

      await loginPage.fillEmail('test@example.com');
      await loginPage.fillPassword('validpassword');

      await loginPage.assertLoginButtonEnabled();
    });
  });

  test.describe('Social Login', () => {
    test('should initiate Google login flow', async () => {
      // Mock OAuth redirect
      await loginPage.page.route('**/auth/google', (route) => {
        route.fulfill({
          status: 302,
          headers: { 'Location': '/auth/google/callback?code=mock_code&state=mock_state' }
        });
      });

      await loginPage.googleLoginButton.click();
      await expect(loginPage.page).toHaveURL(/.*\/auth\/google/);
    });

    test('should initiate GitHub login flow', async () => {
      await loginPage.page.route('**/auth/github', (route) => {
        route.fulfill({
          status: 302,
          headers: { 'Location': '/auth/github/callback?code=mock_code&state=mock_state' }
        });
      });

      await loginPage.githubLoginButton.click();
      await expect(loginPage.page).toHaveURL(/.*\/auth\/github/);
    });

    test('should handle OAuth errors gracefully', async () => {
      await loginPage.page.route('**/auth/google', (route) => {
        route.fulfill({
          status: 302,
          headers: { 'Location': '/login?error=oauth_error&provider=google' }
        });
      });

      await loginPage.googleLoginButton.click();
      await loginPage.assertErrorMessage('Authentication failed. Please try again.');
    });
  });

  test.describe('UI/UX Features', () => {
    test('should toggle password visibility', async () => {
      await loginPage.fillPassword('secretpassword');

      // Initially hidden
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

      // Toggle to show
      await loginPage.togglePasswordVisibility();
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');

      // Toggle back to hide
      await loginPage.togglePasswordVisibility();
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    test('should handle remember me checkbox', async () => {
      await loginPage.assertRememberMeChecked(false);

      await loginPage.checkRememberMe();
      await loginPage.assertRememberMeChecked(true);

      await loginPage.uncheckRememberMe();
      await loginPage.assertRememberMeChecked(false);
    });

    test('should show loading state during login', async () => {
      // Slow down the login request to see loading state
      await loginPage.page.route('**/api/auth/login', (route) => {
        setTimeout(() => {
          route.continue();
        }, 1000);
      });

      await loginPage.fillEmail('user@test.com');
      await loginPage.fillPassword('UserTest123!');
      await loginPage.submitLogin();

      // Should show loading state
      await expect(loginPage.loadingSpinner).toBeVisible();
      await expect(loginPage.loginButton).toHaveText('Logging in...');
      await expect(loginPage.loginButton).toBeDisabled();
    });

    test('should clear form when switching between login and registration', async () => {
      await loginPage.fillEmail('test@example.com');
      await loginPage.fillPassword('password123');

      await loginPage.clickRegister();
      await expect(loginPage.page).toHaveURL(/.*\/register/);

      // Go back to login
      await loginPage.page.goBack();

      // Form should be cleared
      await expect(loginPage.emailInput).toHaveValue('');
      await expect(loginPage.passwordInput).toHaveValue('');
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to forgot password page', async () => {
      await loginPage.clickForgotPassword();
      await expect(loginPage.page).toHaveURL(/.*\/forgot-password/);
    });

    test('should navigate to registration page', async () => {
      await loginPage.clickRegister();
      await expect(loginPage.page).toHaveURL(/.*\/register/);
    });

    test('should redirect authenticated users away from login page', async () => {
      // First login
      await loginPage.login('user@test.com', 'UserTest123!');
      await expect(loginPage.page).toHaveURL(/.*\/dashboard/);

      // Try to access login page while authenticated
      await loginPage.page.goto('/login');

      // Should be redirected to dashboard
      await expect(loginPage.page).toHaveURL(/.*\/dashboard/);
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async () => {
      await loginPage.testKeyboardNavigation();
    });

    test('should support form submission with Enter key', async () => {
      await loginPage.testFormSubmissionWithEnter();
    });

    test('should have proper ARIA labels', async () => {
      await expect(loginPage.emailInput).toHaveAttribute('aria-label', 'Email address');
      await expect(loginPage.passwordInput).toHaveAttribute('aria-label', 'Password');
      await expect(loginPage.loginButton).toHaveAttribute('aria-label', 'Sign in to your account');
    });

    test('should announce errors to screen readers', async () => {
      await loginPage.submitLogin();

      await expect(loginPage.emailValidationError).toHaveAttribute('role', 'alert');
      await expect(loginPage.passwordValidationError).toHaveAttribute('role', 'alert');
    });
  });

  test.describe('Security', () => {
    test('should not expose password in network requests', async ({ page }) => {
      const requests: any[] = [];

      page.on('request', (request) => {
        requests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postDataBuffer()
        });
      });

      await loginPage.login('user@test.com', 'UserTest123!');

      // Check that password is not in plain text in any request
      const loginRequest = requests.find(req => req.url.includes('/api/auth/login'));
      expect(loginRequest).toBeTruthy();

      if (loginRequest.postData) {
        const postDataString = loginRequest.postData.toString();
        expect(postDataString).not.toContain('UserTest123!');
      }
    });

    test('should handle CSRF protection', async () => {
      // Verify CSRF token is present in form
      const csrfToken = await loginPage.page.locator('[name="_token"]').getAttribute('value');
      expect(csrfToken).toBeTruthy();
    });

    test('should secure session cookies', async () => {
      await loginPage.login('user@test.com', 'UserTest123!');

      const cookies = await loginPage.page.context().cookies();
      const sessionCookie = cookies.find(cookie => cookie.name.includes('session'));

      if (sessionCookie) {
        expect(sessionCookie.httpOnly).toBe(true);
        expect(sessionCookie.secure).toBe(true);
        expect(sessionCookie.sameSite).toBe('Strict');
      }
    });
  });

  test.describe('Performance', () => {
    test('should login within acceptable time limits', async () => {
      const performance = await loginPage.measureLoginPerformance();

      expect(performance.formLoadTime).toBeLessThan(2000); // 2 seconds
      expect(performance.loginSubmissionTime).toBeLessThan(3000); // 3 seconds
      expect(performance.totalTime).toBeLessThan(5000); // 5 seconds total
    });

    test('should handle concurrent login attempts', async ({ browser }) => {
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ]);

      const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
      const loginPages = pages.map(page => new LoginPage(page));

      // Attempt simultaneous logins
      await Promise.all(loginPages.map(async (page, index) => {
        await page.goto();
        await page.login('user@test.com', 'UserTest123!');
      }));

      // All should succeed (or handle gracefully)
      for (const page of loginPages) {
        await expect(page.page).toHaveURL(/.*\/(dashboard|login)/);
      }

      // Cleanup
      await Promise.all(contexts.map(ctx => ctx.close()));
    });
  });
});