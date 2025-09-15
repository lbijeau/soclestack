import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { RegistrationPage } from '../../pages/RegistrationPage';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { TestDataFactory } from '../../utils/test-data-factory';

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage;
  let registrationPage: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    registrationPage = new RegistrationPage(page);

    // Ensure test users exist
    await DatabaseHelpers.setupTestUsers();
  });

  test.afterEach(async ({ page }) => {
    // Logout if authenticated
    try {
      const isAuth = await AuthHelpers.isAuthenticated(page);
      if (isAuth) {
        await AuthHelpers.logout(page);
      }
    } catch {
      // Ignore logout errors in cleanup
    }
  });

  test.describe('User Login', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      await loginPage.goto();

      await test.step('Fill login form with valid credentials', async () => {
        await loginPage.login('user@test.com', 'UserTest123!');
      });

      await test.step('Verify successful login redirect', async () => {
        await expect(page).toHaveURL(/.*\/dashboard/);
        await expect(loginPage.userMenu).toBeVisible();
      });

      await test.step('Verify user session is established', async () => {
        const currentUser = await AuthHelpers.getCurrentUser(page);
        expect(currentUser.isAuthenticated).toBe(true);
        expect(currentUser.email).toBe('user@test.com');
      });
    });

    test('should login as admin and redirect to admin panel', async ({ page }) => {
      await loginPage.goto();

      await test.step('Login with admin credentials', async () => {
        await loginPage.login('admin@test.com', 'AdminTest123!');
      });

      await test.step('Verify admin access', async () => {
        await expect(page).toHaveURL(/.*\/admin/);
        await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
      });
    });

    test('should remember user session when remember me is checked', async ({ page, context }) => {
      await loginPage.goto();

      await test.step('Login with remember me option', async () => {
        await loginPage.login('user@test.com', 'UserTest123!', true);
      });

      await test.step('Verify session persistence', async () => {
        await AuthHelpers.testRememberMe(page, context);
      });
    });

    test('should fail login with invalid credentials', async ({ page }) => {
      const invalidCredentials = TestDataFactory.createFormData().invalidLoginData;

      for (const credentials of invalidCredentials) {
        await test.step(`Test invalid credentials: ${JSON.stringify(credentials)}`, async () => {
          await loginPage.goto();

          if (credentials.email !== undefined) {
            await loginPage.fillEmail(credentials.email);
          }
          if (credentials.password !== undefined) {
            await loginPage.fillPassword(credentials.password);
          }

          await loginPage.submitLogin();

          // Should remain on login page
          await expect(page).toHaveURL(/.*\/login/);

          // Should show error message
          await loginPage.assertErrorMessage();
        });
      }
    });

    test('should handle rate limiting after multiple failed attempts', async ({ page }) => {
      const maxAttempts = 5;

      await test.step('Make multiple failed login attempts', async () => {
        for (let i = 0; i < maxAttempts; i++) {
          await loginPage.goto();
          await loginPage.login('user@test.com', 'wrongpassword');
          await loginPage.assertErrorMessage();
        }
      });

      await test.step('Verify rate limiting is activated', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'wrongpassword');

        // Should show rate limit error
        await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible({ timeout: 10000 });
      });
    });

    test('should redirect to intended page after login', async ({ page }) => {
      const protectedPath = '/profile';

      await test.step('Navigate to protected page while unauthenticated', async () => {
        await page.goto(protectedPath);
        await expect(page).toHaveURL(/.*\/login/);
      });

      await test.step('Login and verify redirect to intended page', async () => {
        await loginPage.login('user@test.com', 'UserTest123!');
        await expect(page).toHaveURL(new RegExp(`.*${protectedPath}`));
      });
    });
  });

  test.describe('User Registration', () => {
    test('should register new user successfully', async ({ page }) => {
      const userData = TestDataFactory.createFormData().validRegistrationData;
      await registrationPage.goto();

      await test.step('Fill registration form', async () => {
        await registrationPage.register(userData);
      });

      await test.step('Verify successful registration', async () => {
        await expect(page).toHaveURL(/.*\/(dashboard|email-verification)/);
        await registrationPage.assertSuccessMessage();
      });

      await test.step('Verify user was created in database', async () => {
        const user = await DatabaseHelpers.findUserByEmail(userData.email);
        expect(user).toBeTruthy();
        expect(user.email).toBe(userData.email);
        expect(user.firstName).toBe(userData.firstName);
      });
    });

    test('should fail registration with invalid data', async ({ page }) => {
      const invalidData = TestDataFactory.createFormData().invalidRegistrationData;

      for (const data of invalidData) {
        await test.step(`Test invalid registration data: ${JSON.stringify(data)}`, async () => {
          await registrationPage.goto();
          await registrationPage.fillRegistrationForm(data);
          await registrationPage.submitRegistration();

          // Should remain on registration page
          await expect(page).toHaveURL(/.*\/register/);

          // Should show validation errors
          const hasError = await page.locator('[data-testid*="validation-error"]').first().isVisible({ timeout: 2000 });
          expect(hasError).toBe(true);
        });
      }
    });

    test('should prevent duplicate email registration', async ({ page }) => {
      const userData = TestDataFactory.createUser();

      await test.step('Register first user', async () => {
        await DatabaseHelpers.createTestUser(userData);
      });

      await test.step('Attempt to register with same email', async () => {
        await registrationPage.goto();
        await registrationPage.register({
          email: userData.email,
          password: 'DifferentPassword123!',
          confirmPassword: 'DifferentPassword123!',
          firstName: 'Different',
          lastName: 'User',
          username: 'differentuser',
          termsAccepted: true,
        });

        await expect(page).toHaveURL(/.*\/register/);
        await registrationPage.assertErrorMessage('Email already exists');
      });
    });

    test('should require email verification for new users', async ({ page }) => {
      const userData = TestDataFactory.createFormData().validRegistrationData;
      userData.email = `newuser${Date.now()}@test.com`;

      await test.step('Complete registration', async () => {
        await registrationPage.goto();
        await registrationPage.register(userData);
      });

      await test.step('Verify email verification required', async () => {
        await expect(page).toHaveURL(/.*\/email-verification/);
        await expect(page.locator('[data-testid="verification-message"]')).toBeVisible();
      });

      await test.step('Verify user is unverified in database', async () => {
        const user = await DatabaseHelpers.findUserByEmail(userData.email);
        expect(user.emailVerified).toBe(false);
      });
    });
  });

  test.describe('Password Reset', () => {
    test('should initiate password reset successfully', async ({ page }) => {
      await test.step('Navigate to forgot password page', async () => {
        await loginPage.goto();
        await loginPage.clickForgotPassword();
        await expect(page).toHaveURL(/.*\/forgot-password/);
      });

      await test.step('Request password reset', async () => {
        await page.fill('[data-testid="email-input"]', 'user@test.com');
        await page.click('[data-testid="reset-submit"]');

        await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
        await expect(page.locator('[data-testid="success-message"]')).toContainText('reset link has been sent');
      });

      await test.step('Verify reset token was created', async () => {
        const user = await DatabaseHelpers.findUserByEmail('user@test.com');
        expect(user.passwordResetToken).toBeTruthy();
        expect(user.passwordResetExpires).toBeTruthy();
      });
    });

    test('should reset password with valid token', async ({ page }) => {
      const resetToken = 'test-reset-token-123';
      const newPassword = 'NewPassword123!';

      await test.step('Set up password reset token', async () => {
        await DatabaseHelpers.setPasswordResetToken('user@test.com', resetToken);
      });

      await test.step('Navigate to reset password page with token', async () => {
        await page.goto(`/reset-password?token=${resetToken}`);
        await expect(page.locator('[data-testid="reset-password-form"]')).toBeVisible();
      });

      await test.step('Set new password', async () => {
        await page.fill('[data-testid="new-password-input"]', newPassword);
        await page.fill('[data-testid="confirm-password-input"]', newPassword);
        await page.click('[data-testid="reset-submit"]');

        await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      });

      await test.step('Verify login with new password', async () => {
        await page.goto('/login');
        await loginPage.login('user@test.com', newPassword);
        await expect(page).toHaveURL(/.*\/dashboard/);
      });
    });

    test('should reject invalid or expired reset tokens', async ({ page }) => {
      const invalidTokens = [
        'invalid-token',
        'expired-token',
        '',
        'null',
      ];

      for (const token of invalidTokens) {
        await test.step(`Test invalid token: ${token}`, async () => {
          await page.goto(`/reset-password?token=${token}`);

          // Should redirect to login or show error
          const url = page.url();
          const hasError = url.includes('/login') ||
                          await page.locator('[data-testid="error-message"]').isVisible({ timeout: 2000 });

          expect(hasError).toBe(true);
        });
      }
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page refreshes', async ({ page }) => {
      await test.step('Login user', async () => {
        await AuthHelpers.loginAsUser(page);
      });

      await test.step('Refresh page and verify session', async () => {
        await page.reload();
        await expect(page).toHaveURL(/.*\/dashboard/);
        await expect(loginPage.userMenu).toBeVisible();
      });
    });

    test('should logout user successfully', async ({ page }) => {
      await test.step('Login user', async () => {
        await AuthHelpers.loginAsUser(page);
      });

      await test.step('Logout and verify redirect', async () => {
        await AuthHelpers.logout(page);
        await expect(page).toHaveURL(/.*\/login/);
      });

      await test.step('Verify session is destroyed', async () => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/.*\/login/);
      });
    });

    test('should handle expired sessions gracefully', async ({ page, context }) => {
      await test.step('Login user', async () => {
        await AuthHelpers.loginAsUser(page);
      });

      await test.step('Simulate session expiry', async () => {
        await AuthHelpers.simulateSessionExpiry(page);
      });

      await test.step('Verify redirect to login', async () => {
        await expect(page).toHaveURL(/.*\/login/);
        await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible({ timeout: 5000 });
      });
    });

    test('should support multiple concurrent sessions', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      await test.step('Login same user in different contexts', async () => {
        await AuthHelpers.loginAsUser(page1);
        await AuthHelpers.loginAsUser(page2);
      });

      await test.step('Verify both sessions are active', async () => {
        await expect(page1).toHaveURL(/.*\/dashboard/);
        await expect(page2).toHaveURL(/.*\/dashboard/);

        const user1 = await AuthHelpers.getCurrentUser(page1);
        const user2 = await AuthHelpers.getCurrentUser(page2);

        expect(user1.isAuthenticated).toBe(true);
        expect(user2.isAuthenticated).toBe(true);
      });

      await context1.close();
      await context2.close();
    });

    test('should logout from all devices', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      await test.step('Create multiple sessions', async () => {
        await AuthHelpers.loginAsUser(page1);
        await AuthHelpers.loginAsUser(page2);
      });

      await test.step('Logout from all devices using first session', async () => {
        await page1.goto('/profile/security');
        await page1.click('[data-testid="logout-all-devices"]');
        await expect(page1.locator('[data-testid="success-message"]')).toBeVisible();
      });

      await test.step('Verify all sessions are terminated', async () => {
        await page2.reload();
        await expect(page2).toHaveURL(/.*\/login/);
      });

      await context1.close();
      await context2.close();
    });
  });

  test.describe('Social Authentication', () => {
    test.skip('should authenticate with Google OAuth', async ({ page }) => {
      // Skip for now - requires OAuth setup
      await loginPage.goto();
      await loginPage.assertSocialLoginVisible();
      // TODO: Implement OAuth testing strategy
    });

    test.skip('should authenticate with GitHub OAuth', async ({ page }) => {
      // Skip for now - requires OAuth setup
      await loginPage.goto();
      await loginPage.assertSocialLoginVisible();
      // TODO: Implement OAuth testing strategy
    });
  });

  test.describe('Security Features', () => {
    test('should protect against CSRF attacks', async ({ page, request }) => {
      await test.step('Attempt login without CSRF token', async () => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: 'user@test.com',
            password: 'UserTest123!',
          },
        });

        // Should be rejected due to missing CSRF token
        expect(response.status()).toBe(403);
      });
    });

    test('should sanitize user input', async ({ page }) => {
      const maliciousInputs = TestDataFactory.createSecurityTestData().xssAttempts;

      for (const maliciousInput of maliciousInputs) {
        await test.step(`Test XSS prevention with: ${maliciousInput}`, async () => {
          await loginPage.goto();
          await loginPage.fillEmail(maliciousInput);
          await loginPage.fillPassword('validpassword');
          await loginPage.submitLogin();

          // Check that malicious script doesn't execute
          const alertDialogs = [];
          page.on('dialog', dialog => {
            alertDialogs.push(dialog);
            dialog.dismiss();
          });

          await page.waitForTimeout(1000);
          expect(alertDialogs.length).toBe(0);
        });
      }
    });

    test('should enforce password complexity requirements', async ({ page }) => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        '12345678', // No complexity
        'Password', // Missing number and symbol
        'password123', // Missing uppercase and symbol
      ];

      for (const password of weakPasswords) {
        await test.step(`Test password complexity for: ${password}`, async () => {
          await registrationPage.goto();
          await registrationPage.fillRegistrationForm({
            email: `test${Date.now()}@test.com`,
            password,
            confirmPassword: password,
            firstName: 'Test',
            lastName: 'User',
          });

          await registrationPage.submitRegistration();

          // Should show password complexity error
          await expect(page.locator('[data-testid="password-validation-error"]')).toBeVisible();
        });
      }
    });
  });
});