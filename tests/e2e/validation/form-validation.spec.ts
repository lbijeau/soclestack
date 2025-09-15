import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { RegistrationPage } from '../../pages/RegistrationPage';
import { ExtendedProfilePage as ProfilePage } from '../../pages/ExtendedProfilePage';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { TestDataFactory } from '../../utils/test-data-factory';

test.describe('Form Validation', () => {
  test.beforeEach(async () => {
    await DatabaseHelpers.setupTestUsers();
  });

  test.describe('Client-Side Validation', () => {
    test('should validate login form client-side', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await test.step('Test empty form submission', async () => {
        await loginPage.submitLogin();

        // Should prevent submission and show validation errors
        await expect(page).toHaveURL(/.*\/login/);
        await loginPage.assertEmailValidationError('Email is required');
        await loginPage.assertPasswordValidationError('Password is required');
      });

      await test.step('Test invalid email format', async () => {
        await loginPage.fillEmail('invalid-email');
        await loginPage.fillPassword('ValidPassword123!');
        await loginPage.submitLogin();

        await loginPage.assertEmailValidationError('Please enter a valid email address');
      });

      await test.step('Test real-time validation', async () => {
        await loginPage.fillEmail('test');
        await loginPage.passwordInput.focus(); // Trigger blur on email

        // Should show validation error without form submission
        await loginPage.assertEmailValidationError();
      });

      await test.step('Test validation clear on valid input', async () => {
        await loginPage.fillEmail('valid@test.com');
        await loginPage.passwordInput.focus();

        // Validation error should disappear
        await expect(loginPage.emailValidationError).not.toBeVisible();
      });
    });

    test('should validate registration form client-side', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Test comprehensive form validation', async () => {
        await registrationPage.testFormValidation();
      });

      await test.step('Test real-time validation', async () => {
        await registrationPage.testRealTimeValidation();
      });

      await test.step('Test password strength indicator', async () => {
        await registrationPage.testPasswordStrengthIndicator();
      });

      await test.step('Test password confirmation matching', async () => {
        await registrationPage.fillPassword('TestPassword123!');
        await registrationPage.fillConfirmPassword('DifferentPassword');

        // Should show mismatch error immediately
        await registrationPage.assertConfirmPasswordValidationError('Passwords do not match');

        // Fix the mismatch
        await registrationPage.fillConfirmPassword('TestPassword123!');
        await expect(registrationPage.confirmPasswordValidationError).not.toBeVisible();
      });
    });

    test('should validate profile form client-side', async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await AuthHelpers.loginAsUser(page);
      await profilePage.goto();
      await profilePage.enableEditMode();

      await test.step('Test username validation', async () => {
        // Too short
        await profilePage.fillUsername('ab');
        await profilePage.saveProfile();
        await expect(page.locator('[data-testid="username-validation-error"]')).toContainText('at least 3 characters');

        // Too long
        await profilePage.fillUsername('a'.repeat(51));
        await profilePage.saveProfile();
        await expect(page.locator('[data-testid="username-validation-error"]')).toContainText('maximum 50 characters');

        // Invalid characters
        await profilePage.fillUsername('user@name');
        await profilePage.saveProfile();
        await expect(page.locator('[data-testid="username-validation-error"]')).toContainText('alphanumeric characters only');
      });

      await test.step('Test name validation', async () => {
        // Names with numbers
        await profilePage.fillFirstName('John123');
        await profilePage.saveProfile();
        await expect(page.locator('[data-testid="first-name-validation-error"]')).toContainText('letters only');

        // Names with special characters
        await profilePage.fillLastName('Doe@#$');
        await profilePage.saveProfile();
        await expect(page.locator('[data-testid="last-name-validation-error"]')).toContainText('letters only');
      });
    });
  });

  test.describe('Server-Side Validation', () => {
    test('should validate login credentials server-side', async ({ page, request }) => {
      await test.step('Test API validation with invalid data', async () => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: 'invalid-email',
            password: '',
          },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.errors).toContain('email');
        expect(body.errors).toContain('password');
      });

      await test.step('Test SQL injection prevention', async () => {
        const maliciousInputs = TestDataFactory.createSecurityTestData().sqlInjectionAttempts;

        for (const maliciousInput of maliciousInputs) {
          const response = await request.post('/api/auth/login', {
            data: {
              email: maliciousInput,
              password: 'password',
            },
          });

          // Should not cause server error, should return 400 or 401
          expect(response.status()).toBeLessThan(500);
        }
      });
    });

    test('should validate registration data server-side', async ({ page, request }) => {
      await test.step('Test duplicate email prevention', async () => {
        const response = await request.post('/api/auth/register', {
          data: {
            email: 'user@test.com', // Existing user
            password: 'ValidPassword123!',
            confirmPassword: 'ValidPassword123!',
            firstName: 'Test',
            lastName: 'User',
          },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.message).toContain('email already exists');
      });

      await test.step('Test password complexity enforcement', async () => {
        const weakPasswords = ['123', 'password', 'qwerty'];

        for (const weakPassword of weakPasswords) {
          const response = await request.post('/api/auth/register', {
            data: {
              email: `test${Date.now()}@test.com`,
              password: weakPassword,
              confirmPassword: weakPassword,
              firstName: 'Test',
              lastName: 'User',
            },
          });

          expect(response.status()).toBe(400);
          const body = await response.json();
          expect(body.message).toContain('password');
        }
      });
    });

    test('should validate profile updates server-side', async ({ page, request }) => {
      await AuthHelpers.loginAsUser(page);

      // Get authentication cookies
      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

      await test.step('Test duplicate username prevention', async () => {
        // Create another user first
        await DatabaseHelpers.createTestUser({
          email: 'other@test.com',
          username: 'existinguser',
        });

        const response = await request.put('/api/user/profile', {
          headers: { 'Cookie': cookieHeader },
          data: {
            username: 'existinguser',
          },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.message).toContain('username already exists');
      });

      await test.step('Test email format validation', async () => {
        const response = await request.put('/api/user/profile', {
          headers: { 'Cookie': cookieHeader },
          data: {
            email: 'invalid-email-format',
          },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.errors).toContain('email');
      });
    });
  });

  test.describe('Input Sanitization', () => {
    test('should sanitize XSS attempts in forms', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      const xssAttempts = TestDataFactory.createSecurityTestData().xssAttempts;

      for (const xssAttempt of xssAttempts) {
        await test.step(`Test XSS prevention: ${xssAttempt}`, async () => {
          await registrationPage.fillFirstName(xssAttempt);
          await registrationPage.fillLastName(xssAttempt);

          // Check that scripts don't execute
          let alertFired = false;
          page.on('dialog', async dialog => {
            alertFired = true;
            await dialog.dismiss();
          });

          await page.waitForTimeout(1000);
          expect(alertFired).toBe(false);

          // Check that values are properly escaped
          const firstNameValue = await registrationPage.firstNameInput.inputValue();
          const lastNameValue = await registrationPage.lastNameInput.inputValue();

          // Values should not contain unescaped script tags
          expect(firstNameValue).not.toContain('<script>');
          expect(lastNameValue).not.toContain('<script>');
        });
      }
    });

    test('should handle special characters in input fields', async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await AuthHelpers.loginAsUser(page);
      await profilePage.goto();
      await profilePage.enableEditMode();

      const specialCharacters = [
        'José María',
        'François',
        'Björk',
        '中文',
        'العربية',
        'русский',
        '日本語',
      ];

      for (const name of specialCharacters) {
        await test.step(`Test Unicode support: ${name}`, async () => {
          await profilePage.fillFirstName(name);
          await profilePage.saveProfile();

          // Should accept Unicode characters
          await profilePage.assertSuccessMessage();

          // Verify the name was saved correctly
          await page.reload();
          await expect(profilePage.firstNameInput).toHaveValue(name);
        });
      }
    });
  });

  test.describe('File Upload Validation', () => {
    test('should validate profile picture uploads', async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await AuthHelpers.loginAsUser(page);
      await profilePage.goto();

      await test.step('Test valid image upload', async () => {
        // This would normally be a real image file
        const validImagePath = '/home/luc-bijeau/Projects/soclestack/tests/fixtures/test-avatar.png';

        await profilePage.uploadProfilePicture(validImagePath);
        await profilePage.assertSuccessMessage('Profile picture updated');
      });

      await test.step('Test invalid file type rejection', async () => {
        const invalidFilePath = '/home/luc-bijeau/Projects/soclestack/tests/fixtures/test-document.txt';

        await profilePage.uploadProfilePicture(invalidFilePath);
        await profilePage.assertErrorMessage('Invalid file type');
      });

      await test.step('Test file size limits', async () => {
        // This would be a large file exceeding size limits
        const largeFilePath = '/home/luc-bijeau/Projects/soclestack/tests/fixtures/large-image.jpg';

        await profilePage.uploadProfilePicture(largeFilePath);
        await profilePage.assertErrorMessage('File size too large');
      });
    });
  });

  test.describe('Cross-Field Validation', () => {
    test('should validate password confirmation matching', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Test password mismatch detection', async () => {
        await registrationPage.fillPassword('StrongPassword123!');
        await registrationPage.fillConfirmPassword('DifferentPassword123!');
        await registrationPage.submitRegistration();

        await registrationPage.assertConfirmPasswordValidationError('Passwords do not match');
      });

      await test.step('Test password match validation', async () => {
        await registrationPage.fillConfirmPassword('StrongPassword123!');

        // Error should disappear
        await expect(registrationPage.confirmPasswordValidationError).not.toBeVisible();
      });
    });

    test('should validate email change confirmation', async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await AuthHelpers.loginAsUser(page);
      await profilePage.goto();
      await profilePage.navigateToEmailChange();

      await test.step('Test email change requires password', async () => {
        await profilePage.fillNewEmail('newemail@test.com');
        await profilePage.submitEmailChange();

        await profilePage.assertPasswordValidationError('Password is required');
      });

      await test.step('Test email change validates password', async () => {
        await profilePage.fillCurrentPassword('wrongpassword');
        await profilePage.submitEmailChange();

        await profilePage.assertErrorMessage('Invalid password');
      });
    });
  });

  test.describe('Dynamic Validation', () => {
    test('should provide real-time feedback on form fields', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Test username availability checking', async () => {
        await registrationPage.fillUsername('admin'); // Existing username
        await registrationPage.emailInput.focus(); // Trigger blur

        // Should show availability error
        await expect(page.locator('[data-testid="username-availability-error"]')).toBeVisible();

        await registrationPage.fillUsername('availableusername');
        await registrationPage.emailInput.focus();

        // Should show available indicator
        await expect(page.locator('[data-testid="username-available-indicator"]')).toBeVisible();
      });

      await test.step('Test email availability checking', async () => {
        await registrationPage.fillEmail('user@test.com'); // Existing email
        await registrationPage.passwordInput.focus();

        await expect(page.locator('[data-testid="email-availability-error"]')).toBeVisible();

        await registrationPage.fillEmail('available@test.com');
        await registrationPage.passwordInput.focus();

        await expect(page.locator('[data-testid="email-available-indicator"]')).toBeVisible();
      });
    });

    test('should update validation state based on dependencies', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Test form submission state', async () => {
        // Initially submit button should be disabled
        await registrationPage.assertRegisterButtonDisabled();

        // Fill required fields
        await registrationPage.fillEmail('test@example.com');
        await registrationPage.fillPassword('StrongPassword123!');
        await registrationPage.fillConfirmPassword('StrongPassword123!');
        await registrationPage.checkTerms();

        // Submit button should now be enabled
        await registrationPage.assertRegisterButtonEnabled();

        // Remove required field
        await registrationPage.fillEmail('');

        // Submit button should be disabled again
        await registrationPage.assertRegisterButtonDisabled();
      });
    });
  });

  test.describe('Error Message Display', () => {
    test('should display user-friendly error messages', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await test.step('Test validation error presentation', async () => {
        await loginPage.submitLogin();

        // Errors should be clearly visible and associated with fields
        await expect(loginPage.emailValidationError).toBeVisible();
        await expect(loginPage.passwordValidationError).toBeVisible();

        // Error messages should be descriptive
        await expect(loginPage.emailValidationError).toContainText('Email is required');
        await expect(loginPage.passwordValidationError).toContainText('Password is required');
      });

      await test.step('Test error message accessibility', async () => {
        // Error messages should have proper ARIA attributes
        await expect(loginPage.emailValidationError).toHaveAttribute('role', 'alert');
        await expect(loginPage.passwordValidationError).toHaveAttribute('role', 'alert');

        // Fields should reference their error messages
        await expect(loginPage.emailInput).toHaveAttribute('aria-describedby', /.*email.*error.*/);
        await expect(loginPage.passwordInput).toHaveAttribute('aria-describedby', /.*password.*error.*/);
      });
    });

    test('should clear error messages appropriately', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Test error clearing on valid input', async () => {
        // Trigger validation error
        await registrationPage.fillEmail('invalid');
        await registrationPage.passwordInput.focus();
        await registrationPage.assertEmailValidationError();

        // Fix the error
        await registrationPage.fillEmail('valid@test.com');
        await registrationPage.passwordInput.focus();

        // Error should be cleared
        await expect(registrationPage.emailValidationError).not.toBeVisible();
      });

      await test.step('Test error persistence on continued invalid input', async () => {
        await registrationPage.fillEmail('still-invalid');
        await registrationPage.passwordInput.focus();

        // Error should still be visible
        await registrationPage.assertEmailValidationError();
      });
    });
  });
});