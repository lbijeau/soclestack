import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { TEST_USERS } from '../fixtures/test-users';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly registerLink: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly showPasswordButton: Locator;
  readonly loginForm: Locator;
  readonly socialLoginSection: Locator;
  readonly googleLoginButton: Locator;
  readonly githubLoginButton: Locator;
  readonly emailValidationError: Locator;
  readonly passwordValidationError: Locator;

  constructor(page: Page) {
    super(page);

    // Form elements
    this.loginForm = this.page.locator('[data-testid="login-form"]');
    this.emailInput = this.page.locator('[data-testid="email-input"]');
    this.passwordInput = this.page.locator('[data-testid="password-input"]');
    this.loginButton = this.page.locator('[data-testid="login-submit"]');
    this.rememberMeCheckbox = this.page.locator('[data-testid="remember-me-checkbox"]');
    this.showPasswordButton = this.page.locator('[data-testid="show-password-button"]');

    // Navigation links
    this.forgotPasswordLink = this.page.locator('[data-testid="forgot-password-link"]');
    this.registerLink = this.page.locator('[data-testid="register-link"]');

    // Social login
    this.socialLoginSection = this.page.locator('[data-testid="social-login-section"]');
    this.googleLoginButton = this.page.locator('[data-testid="google-login-button"]');
    this.githubLoginButton = this.page.locator('[data-testid="github-login-button"]');

    // Validation errors
    this.emailValidationError = this.page.locator('[data-testid="email-validation-error"]');
    this.passwordValidationError = this.page.locator('[data-testid="password-validation-error"]');
  }

  // Navigation methods
  async goto(): Promise<void> {
    await this.navigateTo('/login');
    await this.waitForFormToLoad();
  }

  async waitForFormToLoad(): Promise<void> {
    await expect(this.loginForm).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
  }

  // Form interaction methods
  async login(email: string, password: string, rememberMe: boolean = false): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);

    if (rememberMe) {
      await this.checkRememberMe();
    }

    await this.submitLogin();
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.clear();
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.clear();
    await this.passwordInput.fill(password);
  }

  async checkRememberMe(): Promise<void> {
    if (!await this.rememberMeCheckbox.isChecked()) {
      await this.rememberMeCheckbox.check();
    }
  }

  async uncheckRememberMe(): Promise<void> {
    if (await this.rememberMeCheckbox.isChecked()) {
      await this.rememberMeCheckbox.uncheck();
    }
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.showPasswordButton.click();
  }

  async submitLogin(): Promise<void> {
    await this.loginButton.click();
  }

  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL('**/forgot-password');
  }

  async clickRegister(): Promise<void> {
    await this.registerLink.click();
    await this.page.waitForURL('**/register');
  }

  // Social login methods
  async loginWithGoogle(): Promise<void> {
    await this.googleLoginButton.click();
    // Handle OAuth redirect flow
    await this.page.waitForURL('**/auth/google/callback');
  }

  async loginWithGithub(): Promise<void> {
    await this.githubLoginButton.click();
    // Handle OAuth redirect flow
    await this.page.waitForURL('**/auth/github/callback');
  }

  // Validation and assertion methods
  async assertLoginFormVisible(): Promise<void> {
    await expect(this.loginForm).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
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

  async assertLoginButtonDisabled(): Promise<void> {
    await expect(this.loginButton).toBeDisabled();
  }

  async assertLoginButtonEnabled(): Promise<void> {
    await expect(this.loginButton).toBeEnabled();
  }

  async assertRememberMeChecked(shouldBeChecked: boolean): Promise<void> {
    if (shouldBeChecked) {
      await expect(this.rememberMeCheckbox).toBeChecked();
    } else {
      await expect(this.rememberMeCheckbox).not.toBeChecked();
    }
  }

  async assertPasswordFieldType(expectedType: 'password' | 'text'): Promise<void> {
    await expect(this.passwordInput).toHaveAttribute('type', expectedType);
  }

  async assertSocialLoginVisible(): Promise<void> {
    await expect(this.socialLoginSection).toBeVisible();
    await expect(this.googleLoginButton).toBeVisible();
    await expect(this.githubLoginButton).toBeVisible();
  }

  // Test helper methods
  async loginAsValidUser(): Promise<void> {
    await this.login(TEST_USERS.user.email, TEST_USERS.user.password);
    await this.page.waitForURL('**/dashboard');
  }

  async loginAsAdmin(): Promise<void> {
    await this.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
    await this.page.waitForURL('**/admin');
  }

  async attemptInvalidLogin(): Promise<void> {
    await this.login('invalid@test.com', 'wrongpassword');
    await this.assertErrorMessage();
  }

  async testFormValidation(): Promise<void> {
    // Test empty form
    await this.submitLogin();
    await this.assertEmailValidationError('Email is required');
    await this.assertPasswordValidationError('Password is required');

    // Test invalid email format
    await this.fillEmail('invalid-email');
    await this.submitLogin();
    await this.assertEmailValidationError('Please enter a valid email address');

    // Test password too short
    await this.fillEmail('test@example.com');
    await this.fillPassword('123');
    await this.submitLogin();
    await this.assertPasswordValidationError('Password must be at least 8 characters');
  }

  // Accessibility testing methods
  async testKeyboardNavigation(): Promise<void> {
    // Tab through form elements
    await this.page.keyboard.press('Tab');
    await this.assertFocusedElement('[data-testid="email-input"]');

    await this.page.keyboard.press('Tab');
    await this.assertFocusedElement('[data-testid="password-input"]');

    await this.page.keyboard.press('Tab');
    await this.assertFocusedElement('[data-testid="remember-me-checkbox"]');

    await this.page.keyboard.press('Tab');
    await this.assertFocusedElement('[data-testid="login-submit"]');
  }

  async testFormSubmissionWithEnter(): Promise<void> {
    await this.fillEmail(TEST_USERS.user.email);
    await this.fillPassword(TEST_USERS.user.password);
    await this.page.keyboard.press('Enter');
    await this.page.waitForURL('**/dashboard');
  }

  // Performance testing methods
  async measureLoginPerformance(): Promise<{
    formLoadTime: number;
    loginSubmissionTime: number;
    totalTime: number;
  }> {
    const startTime = Date.now();

    await this.goto();
    const formLoadTime = Date.now() - startTime;

    const loginStartTime = Date.now();
    await this.login(TEST_USERS.user.email, TEST_USERS.user.password);
    await this.page.waitForURL('**/dashboard');
    const loginSubmissionTime = Date.now() - loginStartTime;

    return {
      formLoadTime,
      loginSubmissionTime,
      totalTime: Date.now() - startTime
    };
  }
}