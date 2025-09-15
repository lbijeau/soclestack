import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class RegistrationPage extends BasePage {
  readonly registrationForm: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly usernameInput: Locator;
  readonly registerButton: Locator;
  readonly loginLink: Locator;
  readonly termsCheckbox: Locator;
  readonly privacyCheckbox: Locator;
  readonly showPasswordButton: Locator;
  readonly showConfirmPasswordButton: Locator;
  readonly passwordStrengthIndicator: Locator;

  // Validation error elements
  readonly emailValidationError: Locator;
  readonly passwordValidationError: Locator;
  readonly confirmPasswordValidationError: Locator;
  readonly usernameValidationError: Locator;
  readonly firstNameValidationError: Locator;
  readonly lastNameValidationError: Locator;
  readonly termsValidationError: Locator;

  constructor(page: Page) {
    super(page);

    // Form elements
    this.registrationForm = this.page.locator('[data-testid="registration-form"]');
    this.emailInput = this.page.locator('[data-testid="email-input"]');
    this.passwordInput = this.page.locator('[data-testid="password-input"]');
    this.confirmPasswordInput = this.page.locator('[data-testid="confirm-password-input"]');
    this.firstNameInput = this.page.locator('[data-testid="first-name-input"]');
    this.lastNameInput = this.page.locator('[data-testid="last-name-input"]');
    this.usernameInput = this.page.locator('[data-testid="username-input"]');
    this.registerButton = this.page.locator('[data-testid="register-submit"]');
    this.loginLink = this.page.locator('[data-testid="login-link"]');

    // Checkboxes
    this.termsCheckbox = this.page.locator('[data-testid="terms-checkbox"]');
    this.privacyCheckbox = this.page.locator('[data-testid="privacy-checkbox"]');

    // Password visibility toggles
    this.showPasswordButton = this.page.locator('[data-testid="show-password-button"]');
    this.showConfirmPasswordButton = this.page.locator('[data-testid="show-confirm-password-button"]');

    // Password strength indicator
    this.passwordStrengthIndicator = this.page.locator('[data-testid="password-strength"]');

    // Validation errors
    this.emailValidationError = this.page.locator('[data-testid="email-validation-error"]');
    this.passwordValidationError = this.page.locator('[data-testid="password-validation-error"]');
    this.confirmPasswordValidationError = this.page.locator('[data-testid="confirm-password-validation-error"]');
    this.usernameValidationError = this.page.locator('[data-testid="username-validation-error"]');
    this.firstNameValidationError = this.page.locator('[data-testid="first-name-validation-error"]');
    this.lastNameValidationError = this.page.locator('[data-testid="last-name-validation-error"]');
    this.termsValidationError = this.page.locator('[data-testid="terms-validation-error"]');
  }

  // Navigation methods
  async goto(): Promise<void> {
    await this.navigateTo('/register');
    await this.waitForFormToLoad();
  }

  async waitForFormToLoad(): Promise<void> {
    await expect(this.registrationForm).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.registerButton).toBeVisible();
  }

  // Form interaction methods
  async register(userData: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    termsAccepted?: boolean;
    privacyAccepted?: boolean;
  }): Promise<void> {
    await this.fillRegistrationForm(userData);
    await this.submitRegistration();
  }

  async fillRegistrationForm(userData: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    termsAccepted?: boolean;
    privacyAccepted?: boolean;
  }): Promise<void> {
    if (userData.email !== undefined) {
      await this.fillEmail(userData.email);
    }

    if (userData.password !== undefined) {
      await this.fillPassword(userData.password);
    }

    if (userData.confirmPassword !== undefined) {
      await this.fillConfirmPassword(userData.confirmPassword);
    }

    if (userData.firstName !== undefined) {
      await this.fillFirstName(userData.firstName);
    }

    if (userData.lastName !== undefined) {
      await this.fillLastName(userData.lastName);
    }

    if (userData.username !== undefined) {
      await this.fillUsername(userData.username);
    }

    if (userData.termsAccepted) {
      await this.checkTerms();
    }

    if (userData.privacyAccepted) {
      await this.checkPrivacy();
    }
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.clear();
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.clear();
    await this.passwordInput.fill(password);
  }

  async fillConfirmPassword(password: string): Promise<void> {
    await this.confirmPasswordInput.clear();
    await this.confirmPasswordInput.fill(password);
  }

  async fillFirstName(firstName: string): Promise<void> {
    if (await this.firstNameInput.isVisible()) {
      await this.firstNameInput.clear();
      await this.firstNameInput.fill(firstName);
    }
  }

  async fillLastName(lastName: string): Promise<void> {
    if (await this.lastNameInput.isVisible()) {
      await this.lastNameInput.clear();
      await this.lastNameInput.fill(lastName);
    }
  }

  async fillUsername(username: string): Promise<void> {
    if (await this.usernameInput.isVisible()) {
      await this.usernameInput.clear();
      await this.usernameInput.fill(username);
    }
  }

  async checkTerms(): Promise<void> {
    if (!await this.termsCheckbox.isChecked()) {
      await this.termsCheckbox.check();
    }
  }

  async uncheckTerms(): Promise<void> {
    if (await this.termsCheckbox.isChecked()) {
      await this.termsCheckbox.uncheck();
    }
  }

  async checkPrivacy(): Promise<void> {
    if (await this.privacyCheckbox.isVisible() && !await this.privacyCheckbox.isChecked()) {
      await this.privacyCheckbox.check();
    }
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.showPasswordButton.click();
  }

  async toggleConfirmPasswordVisibility(): Promise<void> {
    await this.showConfirmPasswordButton.click();
  }

  async submitRegistration(): Promise<void> {
    await this.registerButton.click();
  }

  async clickLogin(): Promise<void> {
    await this.loginLink.click();
    await this.page.waitForURL('**/login');
  }

  // Validation and assertion methods
  async assertRegistrationFormVisible(): Promise<void> {
    await expect(this.registrationForm).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.registerButton).toBeVisible();
  }

  async assertEmailValidationError(expectedMessage?: string): Promise<void> {
    await expect(this.emailValidationError).toBeVisible();
    if (expectedMessage) {
      await expect(this.emailValidationError).toContainText(expectedMessage);
    }
  }

  async assertPasswordValidationError(expectedMessage?: string): Promise<void> {
    await expect(this.passwordValidationError).toBeVisible();
    if (expectedMessage) {
      await expect(this.passwordValidationError).toContainText(expectedMessage);
    }
  }

  async assertConfirmPasswordValidationError(expectedMessage?: string): Promise<void> {
    await expect(this.confirmPasswordValidationError).toBeVisible();
    if (expectedMessage) {
      await expect(this.confirmPasswordValidationError).toContainText(expectedMessage);
    }
  }

  async assertUsernameValidationError(expectedMessage?: string): Promise<void> {
    await expect(this.usernameValidationError).toBeVisible();
    if (expectedMessage) {
      await expect(this.usernameValidationError).toContainText(expectedMessage);
    }
  }

  async assertTermsValidationError(expectedMessage?: string): Promise<void> {
    await expect(this.termsValidationError).toBeVisible();
    if (expectedMessage) {
      await expect(this.termsValidationError).toContainText(expectedMessage);
    }
  }

  async assertRegisterButtonDisabled(): Promise<void> {
    await expect(this.registerButton).toBeDisabled();
  }

  async assertRegisterButtonEnabled(): Promise<void> {
    await expect(this.registerButton).toBeEnabled();
  }

  async assertPasswordStrength(expectedStrength: 'weak' | 'medium' | 'strong'): Promise<void> {
    await expect(this.passwordStrengthIndicator).toBeVisible();
    await expect(this.passwordStrengthIndicator).toContainText(expectedStrength);
  }

  async assertPasswordFieldType(fieldType: 'password' | 'confirm', expectedType: 'password' | 'text'): Promise<void> {
    const field = fieldType === 'password' ? this.passwordInput : this.confirmPasswordInput;
    await expect(field).toHaveAttribute('type', expectedType);
  }

  // Test helper methods
  async testPasswordStrengthIndicator(): Promise<void> {
    // Test weak password
    await this.fillPassword('123');
    await this.assertPasswordStrength('weak');

    // Test medium password
    await this.fillPassword('Password123');
    await this.assertPasswordStrength('medium');

    // Test strong password
    await this.fillPassword('StrongPassword123!');
    await this.assertPasswordStrength('strong');
  }

  async testPasswordVisibilityToggle(): Promise<void> {
    await this.fillPassword('TestPassword123!');

    // Initially password should be hidden
    await this.assertPasswordFieldType('password', 'password');

    // Toggle visibility
    await this.togglePasswordVisibility();
    await this.assertPasswordFieldType('password', 'text');

    // Toggle back
    await this.togglePasswordVisibility();
    await this.assertPasswordFieldType('password', 'password');
  }

  async testFormValidation(): Promise<void> {
    // Test empty form submission
    await this.submitRegistration();

    await this.assertEmailValidationError('Email is required');
    await this.assertPasswordValidationError('Password is required');

    // Test invalid email
    await this.fillEmail('invalid-email');
    await this.submitRegistration();
    await this.assertEmailValidationError('Please enter a valid email address');

    // Test password mismatch
    await this.fillEmail('test@example.com');
    await this.fillPassword('Password123!');
    await this.fillConfirmPassword('DifferentPassword123!');
    await this.submitRegistration();
    await this.assertConfirmPasswordValidationError('Passwords do not match');

    // Test terms not accepted
    await this.fillConfirmPassword('Password123!');
    await this.uncheckTerms();
    await this.submitRegistration();
    await this.assertTermsValidationError('You must accept the terms and conditions');
  }

  async testRealTimeValidation(): Promise<void> {
    // Test email validation on blur
    await this.fillEmail('invalid');
    await this.passwordInput.focus(); // Blur email field
    await this.assertEmailValidationError();

    // Test password confirmation on input
    await this.fillPassword('Password123!');
    await this.fillConfirmPassword('Different');
    await this.assertConfirmPasswordValidationError();

    // Fix password confirmation
    await this.fillConfirmPassword('Password123!');
    await expect(this.confirmPasswordValidationError).not.toBeVisible();
  }

  // Accessibility testing methods
  async testKeyboardNavigation(): Promise<void> {
    // Tab through form elements in order
    const expectedOrder = [
      '[data-testid="email-input"]',
      '[data-testid="password-input"]',
      '[data-testid="show-password-button"]',
      '[data-testid="confirm-password-input"]',
      '[data-testid="show-confirm-password-button"]',
      '[data-testid="first-name-input"]',
      '[data-testid="last-name-input"]',
      '[data-testid="username-input"]',
      '[data-testid="terms-checkbox"]',
      '[data-testid="register-submit"]',
    ];

    for (let i = 0; i < expectedOrder.length; i++) {
      if (i > 0) await this.page.keyboard.press('Tab');

      const selector = expectedOrder[i];
      const element = this.page.locator(selector);

      if (await element.isVisible()) {
        await this.assertFocusedElement(selector);
      }
    }
  }

  async testFormSubmissionWithEnter(): Promise<void> {
    await this.fillRegistrationForm({
      email: 'test@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      termsAccepted: true,
    });

    await this.registerButton.focus();
    await this.page.keyboard.press('Enter');

    // Should submit the form
    await expect(this.page).not.toHaveURL(/.*\/register/);
  }

  // Performance testing methods
  async measureRegistrationPerformance(): Promise<{
    formLoadTime: number;
    validationTime: number;
    submissionTime: number;
    totalTime: number;
  }> {
    const startTime = Date.now();

    await this.goto();
    const formLoadTime = Date.now() - startTime;

    // Measure validation performance
    const validationStartTime = Date.now();
    await this.fillEmail('test');
    await this.passwordInput.focus(); // Trigger validation
    await this.assertEmailValidationError();
    const validationTime = Date.now() - validationStartTime;

    // Measure submission performance
    const submissionStartTime = Date.now();
    await this.fillRegistrationForm({
      email: `perftest${Date.now()}@test.com`,
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
      firstName: 'Performance',
      lastName: 'Test',
      termsAccepted: true,
    });
    await this.submitRegistration();
    await this.page.waitForLoadState('networkidle');
    const submissionTime = Date.now() - submissionStartTime;

    return {
      formLoadTime,
      validationTime,
      submissionTime,
      totalTime: Date.now() - startTime,
    };
  }
}