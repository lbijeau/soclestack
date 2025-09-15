import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProfilePage extends BasePage {
  readonly profileContainer: Locator;
  readonly profileForm: Locator;
  readonly avatarImage: Locator;
  readonly avatarUpload: Locator;
  readonly avatarRemoveButton: Locator;

  // Personal Information
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly birthdateInput: Locator;
  readonly genderSelect: Locator;
  readonly bioTextarea: Locator;

  // Address Information
  readonly addressSection: Locator;
  readonly streetInput: Locator;
  readonly cityInput: Locator;
  readonly stateSelect: Locator;
  readonly zipCodeInput: Locator;
  readonly countrySelect: Locator;

  // Account Settings
  readonly accountSettingsSection: Locator;
  readonly usernameInput: Locator;
  readonly languageSelect: Locator;
  readonly timezoneSelect: Locator;
  readonly twoFactorToggle: Locator;
  readonly emailNotificationsToggle: Locator;
  readonly smsNotificationsToggle: Locator;

  // Password Change
  readonly passwordSection: Locator;
  readonly currentPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmNewPasswordInput: Locator;
  readonly changePasswordButton: Locator;

  // Action Buttons
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteAccountButton: Locator;

  // Validation Errors
  readonly firstNameError: Locator;
  readonly lastNameError: Locator;
  readonly emailError: Locator;
  readonly phoneError: Locator;
  readonly usernameError: Locator;
  readonly currentPasswordError: Locator;
  readonly newPasswordError: Locator;
  readonly confirmPasswordError: Locator;

  // Modals
  readonly deleteAccountModal: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;
  readonly deleteConfirmationInput: Locator;

  constructor(page: Page) {
    super(page);

    // Main containers
    this.profileContainer = this.page.locator('[data-testid="profile-container"]');
    this.profileForm = this.page.locator('[data-testid="profile-form"]');

    // Avatar
    this.avatarImage = this.page.locator('[data-testid="avatar-image"]');
    this.avatarUpload = this.page.locator('[data-testid="avatar-upload"]');
    this.avatarRemoveButton = this.page.locator('[data-testid="avatar-remove"]');

    // Personal Information
    this.firstNameInput = this.page.locator('[data-testid="first-name-input"]');
    this.lastNameInput = this.page.locator('[data-testid="last-name-input"]');
    this.emailInput = this.page.locator('[data-testid="email-input"]');
    this.phoneInput = this.page.locator('[data-testid="phone-input"]');
    this.birthdateInput = this.page.locator('[data-testid="birthdate-input"]');
    this.genderSelect = this.page.locator('[data-testid="gender-select"]');
    this.bioTextarea = this.page.locator('[data-testid="bio-textarea"]');

    // Address Information
    this.addressSection = this.page.locator('[data-testid="address-section"]');
    this.streetInput = this.page.locator('[data-testid="street-input"]');
    this.cityInput = this.page.locator('[data-testid="city-input"]');
    this.stateSelect = this.page.locator('[data-testid="state-select"]');
    this.zipCodeInput = this.page.locator('[data-testid="zip-code-input"]');
    this.countrySelect = this.page.locator('[data-testid="country-select"]');

    // Account Settings
    this.accountSettingsSection = this.page.locator('[data-testid="account-settings-section"]');
    this.usernameInput = this.page.locator('[data-testid="username-input"]');
    this.languageSelect = this.page.locator('[data-testid="language-select"]');
    this.timezoneSelect = this.page.locator('[data-testid="timezone-select"]');
    this.twoFactorToggle = this.page.locator('[data-testid="two-factor-toggle"]');
    this.emailNotificationsToggle = this.page.locator('[data-testid="email-notifications-toggle"]');
    this.smsNotificationsToggle = this.page.locator('[data-testid="sms-notifications-toggle"]');

    // Password Change
    this.passwordSection = this.page.locator('[data-testid="password-section"]');
    this.currentPasswordInput = this.page.locator('[data-testid="current-password-input"]');
    this.newPasswordInput = this.page.locator('[data-testid="new-password-input"]');
    this.confirmNewPasswordInput = this.page.locator('[data-testid="confirm-new-password-input"]');
    this.changePasswordButton = this.page.locator('[data-testid="change-password-button"]');

    // Action Buttons
    this.saveButton = this.page.locator('[data-testid="save-button"]');
    this.cancelButton = this.page.locator('[data-testid="cancel-button"]');
    this.deleteAccountButton = this.page.locator('[data-testid="delete-account-button"]');

    // Validation Errors
    this.firstNameError = this.page.locator('[data-testid="first-name-error"]');
    this.lastNameError = this.page.locator('[data-testid="last-name-error"]');
    this.emailError = this.page.locator('[data-testid="email-error"]');
    this.phoneError = this.page.locator('[data-testid="phone-error"]');
    this.usernameError = this.page.locator('[data-testid="username-error"]');
    this.currentPasswordError = this.page.locator('[data-testid="current-password-error"]');
    this.newPasswordError = this.page.locator('[data-testid="new-password-error"]');
    this.confirmPasswordError = this.page.locator('[data-testid="confirm-password-error"]');

    // Modals
    this.deleteAccountModal = this.page.locator('[data-testid="delete-account-modal"]');
    this.confirmDeleteButton = this.page.locator('[data-testid="confirm-delete-button"]');
    this.cancelDeleteButton = this.page.locator('[data-testid="cancel-delete-button"]');
    this.deleteConfirmationInput = this.page.locator('[data-testid="delete-confirmation-input"]');
  }

  // Navigation methods
  async goto(): Promise<void> {
    await this.navigateTo('/profile');
    await this.waitForProfileToLoad();
  }

  async waitForProfileToLoad(): Promise<void> {
    await expect(this.profileContainer).toBeVisible();
    await expect(this.profileForm).toBeVisible();
    await this.waitForLoadingToComplete();
  }

  // Avatar methods
  async uploadAvatar(filePath: string): Promise<void> {
    await this.avatarUpload.setInputFiles(filePath);
    await this.waitForApiResponse('**/api/profile/avatar');
  }

  async removeAvatar(): Promise<void> {
    await this.avatarRemoveButton.click();
    await this.waitForApiResponse('**/api/profile/avatar');
  }

  // Personal information methods
  async updatePersonalInfo(personalInfo: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    birthdate?: string;
    gender?: string;
    bio?: string;
  }): Promise<void> {
    if (personalInfo.firstName !== undefined) {
      await this.fillFormField('[data-testid="first-name-input"]', personalInfo.firstName);
    }
    if (personalInfo.lastName !== undefined) {
      await this.fillFormField('[data-testid="last-name-input"]', personalInfo.lastName);
    }
    if (personalInfo.email !== undefined) {
      await this.fillFormField('[data-testid="email-input"]', personalInfo.email);
    }
    if (personalInfo.phone !== undefined) {
      await this.fillFormField('[data-testid="phone-input"]', personalInfo.phone);
    }
    if (personalInfo.birthdate !== undefined) {
      await this.fillFormField('[data-testid="birthdate-input"]', personalInfo.birthdate);
    }
    if (personalInfo.gender !== undefined) {
      await this.selectDropdownOption('[data-testid="gender-select"]', personalInfo.gender);
    }
    if (personalInfo.bio !== undefined) {
      await this.fillFormField('[data-testid="bio-textarea"]', personalInfo.bio);
    }
  }

  // Address methods
  async updateAddress(addressInfo: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }): Promise<void> {
    if (addressInfo.street !== undefined) {
      await this.fillFormField('[data-testid="street-input"]', addressInfo.street);
    }
    if (addressInfo.city !== undefined) {
      await this.fillFormField('[data-testid="city-input"]', addressInfo.city);
    }
    if (addressInfo.state !== undefined) {
      await this.selectDropdownOption('[data-testid="state-select"]', addressInfo.state);
    }
    if (addressInfo.zipCode !== undefined) {
      await this.fillFormField('[data-testid="zip-code-input"]', addressInfo.zipCode);
    }
    if (addressInfo.country !== undefined) {
      await this.selectDropdownOption('[data-testid="country-select"]', addressInfo.country);
    }
  }

  // Account settings methods
  async updateAccountSettings(settings: {
    username?: string;
    language?: string;
    timezone?: string;
    twoFactor?: boolean;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
  }): Promise<void> {
    if (settings.username !== undefined) {
      await this.fillFormField('[data-testid="username-input"]', settings.username);
    }
    if (settings.language !== undefined) {
      await this.selectDropdownOption('[data-testid="language-select"]', settings.language);
    }
    if (settings.timezone !== undefined) {
      await this.selectDropdownOption('[data-testid="timezone-select"]', settings.timezone);
    }
    if (settings.twoFactor !== undefined) {
      await this.toggleSetting(this.twoFactorToggle, settings.twoFactor);
    }
    if (settings.emailNotifications !== undefined) {
      await this.toggleSetting(this.emailNotificationsToggle, settings.emailNotifications);
    }
    if (settings.smsNotifications !== undefined) {
      await this.toggleSetting(this.smsNotificationsToggle, settings.smsNotifications);
    }
  }

  private async toggleSetting(toggleElement: Locator, enabled: boolean): Promise<void> {
    const isCurrentlyChecked = await toggleElement.isChecked();
    if (isCurrentlyChecked !== enabled) {
      await toggleElement.click();
    }
  }

  // Password change methods
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.fillFormField('[data-testid="current-password-input"]', currentPassword);
    await this.fillFormField('[data-testid="new-password-input"]', newPassword);
    await this.fillFormField('[data-testid="confirm-new-password-input"]', newPassword);
    await this.changePasswordButton.click();
    await this.waitForApiResponse('**/api/profile/password');
  }

  // Form actions
  async saveProfile(): Promise<void> {
    await this.saveButton.click();
    await this.waitForApiResponse('**/api/profile');
  }

  async cancelChanges(): Promise<void> {
    await this.cancelButton.click();
  }

  async deleteAccount(confirmationText: string): Promise<void> {
    await this.deleteAccountButton.click();
    await expect(this.deleteAccountModal).toBeVisible();
    await this.deleteConfirmationInput.fill(confirmationText);
    await this.confirmDeleteButton.click();
    await this.waitForApiResponse('**/api/profile/delete');
  }

  // Validation methods
  async assertFieldError(field: string, expectedMessage?: string): Promise<void> {
    const errorLocator = this.page.locator(`[data-testid="${field}-error"]`);
    await expect(errorLocator).toBeVisible();
    if (expectedMessage) {
      await expect(errorLocator).toContainText(expectedMessage);
    }
  }

  async assertProfileSaved(): Promise<void> {
    await this.assertSuccessMessage('Profile updated successfully');
  }

  async assertPasswordChanged(): Promise<void> {
    await this.assertSuccessMessage('Password changed successfully');
  }

  async assertAccountDeleted(): Promise<void> {
    await this.page.waitForURL('**/account-deleted');
  }

  // Test helper methods
  async testCompleteProfileUpdate(): Promise<void> {
    const testData = {
      firstName: 'Updated',
      lastName: 'User',
      email: 'updated.user@example.com',
      phone: '+1-555-123-4567',
      birthdate: '1990-01-01',
      gender: 'prefer-not-to-say',
      bio: 'This is my updated bio'
    };

    const addressData = {
      street: '123 Updated Street',
      city: 'Updated City',
      state: 'CA',
      zipCode: '90210',
      country: 'US'
    };

    const settingsData = {
      username: 'updateduser',
      language: 'en',
      timezone: 'America/Los_Angeles',
      emailNotifications: true,
      smsNotifications: false
    };

    await this.updatePersonalInfo(testData);
    await this.updateAddress(addressData);
    await this.updateAccountSettings(settingsData);
    await this.saveProfile();
    await this.assertProfileSaved();
  }

  async testFormValidation(): Promise<void> {
    // Test invalid email
    await this.updatePersonalInfo({ email: 'invalid-email' });
    await this.saveProfile();
    await this.assertFieldError('email', 'Please enter a valid email address');

    // Test invalid phone number
    await this.updatePersonalInfo({
      email: 'valid@example.com',
      phone: 'invalid-phone'
    });
    await this.saveProfile();
    await this.assertFieldError('phone', 'Please enter a valid phone number');

    // Test username too short
    await this.updateAccountSettings({ username: 'ab' });
    await this.saveProfile();
    await this.assertFieldError('username', 'Username must be at least 3 characters');

    // Test future birthdate
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    await this.updatePersonalInfo({
      birthdate: futureDate.toISOString().split('T')[0]
    });
    await this.saveProfile();
    await this.assertFieldError('birthdate', 'Birthdate cannot be in the future');
  }

  async testPasswordChangeValidation(): Promise<void> {
    // Test empty current password
    await this.changePasswordButton.click();
    await this.assertFieldError('current-password', 'Current password is required');

    // Test short new password
    await this.fillFormField('[data-testid="current-password-input"]', 'currentpassword');
    await this.fillFormField('[data-testid="new-password-input"]', '123');
    await this.changePasswordButton.click();
    await this.assertFieldError('new-password', 'Password must be at least 8 characters');

    // Test password mismatch
    await this.fillFormField('[data-testid="new-password-input"]', 'newpassword123');
    await this.fillFormField('[data-testid="confirm-new-password-input"]', 'differentpassword');
    await this.changePasswordButton.click();
    await this.assertFieldError('confirm-password', 'Passwords do not match');

    // Test same as current password
    await this.fillFormField('[data-testid="new-password-input"]', 'currentpassword');
    await this.fillFormField('[data-testid="confirm-new-password-input"]', 'currentpassword');
    await this.changePasswordButton.click();
    await this.assertFieldError('new-password', 'New password must be different from current password');
  }

  // Accessibility testing methods
  async testKeyboardNavigation(): Promise<void> {
    // Tab through all form fields
    const focusableElements = [
      '[data-testid="first-name-input"]',
      '[data-testid="last-name-input"]',
      '[data-testid="email-input"]',
      '[data-testid="phone-input"]',
      '[data-testid="birthdate-input"]',
      '[data-testid="gender-select"]',
      '[data-testid="bio-textarea"]',
      '[data-testid="save-button"]'
    ];

    for (let i = 0; i < focusableElements.length; i++) {
      await this.page.keyboard.press('Tab');
      await this.assertFocusedElement(focusableElements[i]);
    }
  }

  // Performance testing methods
  async measureProfileUpdatePerformance(): Promise<{
    pageLoadTime: number;
    updateTime: number;
    totalTime: number;
  }> {
    const startTime = Date.now();

    await this.goto();
    const pageLoadTime = Date.now() - startTime;

    const updateStartTime = Date.now();
    await this.testCompleteProfileUpdate();
    const updateTime = Date.now() - updateStartTime;

    return {
      pageLoadTime,
      updateTime,
      totalTime: Date.now() - startTime
    };
  }
}