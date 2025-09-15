import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../../pages/RegistrationPage';
import { LoginPage } from '../../pages/LoginPage';
import { faker } from '@faker-js/faker';

test.describe('User Registration', () => {
  let registrationPage: RegistrationPage;
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    loginPage = new LoginPage(page);
    await registrationPage.goto();
  });

  test.describe('Registration Form Display', () => {
    test('should display all registration form elements', async () => {
      await registrationPage.assertRegistrationFormVisible();
      await registrationPage.assertSocialRegistrationVisible();
    });

    test('should have proper form structure and labels', async () => {
      // Check form accessibility
      await expect(registrationPage.registrationForm).toHaveAttribute('role', 'form');

      // Check required field indicators
      await expect(registrationPage.firstNameInput).toHaveAttribute('required');
      await expect(registrationPage.lastNameInput).toHaveAttribute('required');
      await expect(registrationPage.emailInput).toHaveAttribute('required');
      await expect(registrationPage.passwordInput).toHaveAttribute('required');
      await expect(registrationPage.confirmPasswordInput).toHaveAttribute('required');
    });

    test('should display password strength indicator', async () => {
      await registrationPage.fillPassword('weak');
      await registrationPage.assertPasswordStrength('weak');

      await registrationPage.fillPassword('betterpass123');
      await registrationPage.assertPasswordStrength('medium');

      await registrationPage.fillPassword('SecurePassword123!');
      await registrationPage.assertPasswordStrength('strong');
    });
  });

  test.describe('Successful Registration', () => {
    test('should successfully register a new user with valid data', async () => {
      const userData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email().toLowerCase(),
        password: 'SecurePassword123!',
        agreeTerms: true,
        newsletter: false
      };

      await registrationPage.register(userData);

      await registrationPage.assertSuccessMessage('Registration successful! Please check your email to verify your account.');
      await expect(registrationPage.page).toHaveURL(/.*\/registration-success/);
    });

    test('should register user with newsletter subscription', async () => {
      const userData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email().toLowerCase(),
        password: 'SecurePassword123!',
        agreeTerms: true,
        newsletter: true
      };

      await registrationPage.register(userData);
      await registrationPage.assertSuccessMessage();
    });

    test('should handle special characters in names', async () => {
      const userData = {
        firstName: 'José María',
        lastName: 'O\'Connor-Smith',
        email: faker.internet.email().toLowerCase(),
        password: 'SecurePassword123!',
        agreeTerms: true
      };

      await registrationPage.register(userData);
      await registrationPage.assertSuccessMessage();
    });

    test('should register with minimum valid password', async () => {
      const userData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email().toLowerCase(),
        password: 'MinPass1!',  // 9 characters, meets requirements
        agreeTerms: true
      };

      await registrationPage.register(userData);
      await registrationPage.assertSuccessMessage();
    });
  });

  test.describe('Form Validation', () => {
    test('should show validation errors for empty form', async () => {
      await registrationPage.submitRegistration();

      await registrationPage.assertFieldError('firstName', 'First name is required');
      await registrationPage.assertFieldError('lastName', 'Last name is required');
      await registrationPage.assertFieldError('email', 'Email is required');
      await registrationPage.assertFieldError('password', 'Password is required');
      await registrationPage.assertFieldError('terms', 'You must agree to the terms and conditions');
    });

    test('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        'invalid@',
        '@invalid.com',
        'invalid@.com',
        'invalid..email@test.com'
      ];

      for (const email of invalidEmails) {
        await registrationPage.fillFirstName('Test');
        await registrationPage.fillLastName('User');
        await registrationPage.fillEmail(email);
        await registrationPage.fillPassword('Password123!');
        await registrationPage.fillConfirmPassword('Password123!');
        await registrationPage.checkAgreeTerms();
        await registrationPage.submitRegistration();

        await registrationPage.assertFieldError('email', 'Please enter a valid email address');

        // Clear form for next iteration
        await registrationPage.page.reload();
        await registrationPage.waitForFormToLoad();
      }
    });

    test('should validate password requirements', async () => {
      const passwordTests = [
        { password: '123', error: 'Password must be at least 8 characters' },
        { password: 'password', error: 'Password must contain at least one uppercase letter' },
        { password: 'PASSWORD', error: 'Password must contain at least one lowercase letter' },
        { password: 'Password', error: 'Password must contain at least one number' },
        { password: 'Password123', error: 'Password must contain at least one special character' }
      ];

      for (const test of passwordTests) {
        await registrationPage.fillFirstName('Test');
        await registrationPage.fillLastName('User');
        await registrationPage.fillEmail('test@example.com');
        await registrationPage.fillPassword(test.password);
        await registrationPage.fillConfirmPassword(test.password);
        await registrationPage.checkAgreeTerms();
        await registrationPage.submitRegistration();

        await registrationPage.assertFieldError('password', test.error);

        // Clear form for next iteration
        await registrationPage.page.reload();
        await registrationPage.waitForFormToLoad();
      }
    });

    test('should validate password confirmation', async () => {
      await registrationPage.fillFirstName('Test');
      await registrationPage.fillLastName('User');
      await registrationPage.fillEmail('test@example.com');
      await registrationPage.fillPassword('SecurePassword123!');
      await registrationPage.fillConfirmPassword('DifferentPassword123!');
      await registrationPage.checkAgreeTerms();
      await registrationPage.submitRegistration();

      await registrationPage.assertFieldError('confirmPassword', 'Passwords do not match');
    });

    test('should validate terms agreement requirement', async () => {
      await registrationPage.fillFirstName('Test');
      await registrationPage.fillLastName('User');
      await registrationPage.fillEmail('test@example.com');
      await registrationPage.fillPassword('SecurePassword123!');
      await registrationPage.fillConfirmPassword('SecurePassword123!');
      // Don't check terms
      await registrationPage.submitRegistration();

      await registrationPage.assertFieldError('terms', 'You must agree to the terms and conditions');
    });

    test('should validate name length limits', async () => {
      const longName = 'A'.repeat(51); // Assuming 50 character limit

      await registrationPage.fillFirstName(longName);
      await registrationPage.submitRegistration();
      await registrationPage.assertFieldError('firstName', 'First name must be less than 50 characters');

      await registrationPage.fillFirstName('Valid');
      await registrationPage.fillLastName(longName);
      await registrationPage.submitRegistration();
      await registrationPage.assertFieldError('lastName', 'Last name must be less than 50 characters');
    });
  });

  test.describe('Duplicate Email Handling', () => {
    test('should prevent registration with existing email', async () => {
      const existingEmail = 'existing.user@test.com';

      // First registration
      const userData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: existingEmail,
        password: 'SecurePassword123!',
        agreeTerms: true
      };

      await registrationPage.register(userData);
      await registrationPage.assertSuccessMessage();

      // Attempt second registration with same email
      await registrationPage.goto();
      await registrationPage.register({
        firstName: 'Different',
        lastName: 'User',
        email: existingEmail,
        password: 'AnotherPassword123!',
        agreeTerms: true
      });

      await registrationPage.assertErrorMessage('An account with this email address already exists');
    });

    test('should suggest login for existing email', async () => {
      await registrationPage.fillEmail('existing.user@test.com');
      await registrationPage.submitRegistration();

      await expect(registrationPage.page.locator('[data-testid="existing-email-suggestion"]')).toBeVisible();
      await expect(registrationPage.page.locator('[data-testid="existing-email-suggestion"]'))
        .toContainText('Already have an account? Sign in here');
    });
  });

  test.describe('Social Registration', () => {
    test('should display social registration options', async () => {
      await registrationPage.assertSocialLoginVisible();
    });

    test('should initiate Google registration flow', async () => {
      // Mock OAuth redirect
      await registrationPage.page.route('**/auth/google', (route) => {
        route.fulfill({
          status: 302,
          headers: { 'Location': '/auth/google/callback?code=mock_code' }
        });
      });

      await registrationPage.googleRegisterButton.click();
      await expect(registrationPage.page).toHaveURL(/.*\/auth\/google/);
    });

    test('should initiate GitHub registration flow', async () => {
      await registrationPage.page.route('**/auth/github', (route) => {
        route.fulfill({
          status: 302,
          headers: { 'Location': '/auth/github/callback?code=mock_code' }
        });
      });

      await registrationPage.githubRegisterButton.click();
      await expect(registrationPage.page).toHaveURL(/.*\/auth\/github/);
    });
  });

  test.describe('UI/UX Features', () => {
    test('should toggle password visibility', async () => {
      await registrationPage.fillPassword('SecurePassword123!');

      // Initially should be password type
      await registrationPage.assertPasswordFieldType('password');

      // Toggle to show password
      await registrationPage.togglePasswordVisibility();
      await expect(registrationPage.passwordInput).toHaveAttribute('type', 'text');

      // Toggle back to hide password
      await registrationPage.togglePasswordVisibility();
      await expect(registrationPage.passwordInput).toHaveAttribute('type', 'password');
    });

    test('should toggle confirm password visibility', async () => {
      await registrationPage.fillConfirmPassword('SecurePassword123!');

      await registrationPage.toggleConfirmPasswordVisibility();
      await expect(registrationPage.confirmPasswordInput).toHaveAttribute('type', 'text');

      await registrationPage.toggleConfirmPasswordVisibility();
      await expect(registrationPage.confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    test('should show real-time password strength feedback', async () => {
      // Test progression through different strength levels
      await registrationPage.fillPassword('a');
      await registrationPage.assertPasswordStrength('weak');
      await registrationPage.assertPasswordRequirementsVisible();

      await registrationPage.fillPassword('password123');
      await registrationPage.assertPasswordStrength('medium');

      await registrationPage.fillPassword('SecurePassword123!');
      await registrationPage.assertPasswordStrength('strong');
    });

    test('should enable/disable submit button based on form validity', async () => {
      // Initially disabled
      await registrationPage.assertRegisterButtonDisabled();

      // Fill all required fields
      await registrationPage.fillFirstName('John');
      await registrationPage.fillLastName('Doe');
      await registrationPage.fillEmail('john.doe@example.com');
      await registrationPage.fillPassword('SecurePassword123!');
      await registrationPage.fillConfirmPassword('SecurePassword123!');
      await registrationPage.checkAgreeTerms();

      // Should be enabled now
      await registrationPage.assertRegisterButtonEnabled();

      // Uncheck terms - should disable again
      await registrationPage.uncheckAgreeTerms();
      await registrationPage.assertRegisterButtonDisabled();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to login page from registration', async () => {
      await registrationPage.clickLoginLink();
      await expect(registrationPage.page).toHaveURL(/.*\/login/);
      await loginPage.assertLoginFormVisible();
    });

    test('should handle browser back button correctly', async () => {
      await registrationPage.fillFirstName('Test');
      await registrationPage.fillLastName('User');

      // Navigate away and back
      await registrationPage.page.goBack();
      await registrationPage.page.goForward();

      // Form should be preserved or cleared appropriately
      await registrationPage.waitForFormToLoad();
    });
  });

  test.describe('Performance', () => {
    test('should load registration form within acceptable time', async () => {
      const performance = await registrationPage.measureRegistrationPerformance();

      expect(performance.formLoadTime).toBeLessThan(3000); // 3 seconds
      expect(performance.totalTime).toBeLessThan(10000); // 10 seconds for full flow
    });

    test('should handle rapid form submission attempts', async () => {
      const userData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email().toLowerCase(),
        password: 'SecurePassword123!',
        agreeTerms: true
      };

      await registrationPage.register(userData);

      // Attempt rapid subsequent submissions
      for (let i = 0; i < 3; i++) {
        await registrationPage.registerButton.click();
      }

      // Should handle gracefully without duplicate registrations
      await registrationPage.assertSuccessMessage();
    });
  });
});