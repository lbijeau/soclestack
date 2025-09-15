import { Page, Locator, expect } from '@playwright/test';
import { ProfilePage } from './ProfilePage';

export class ExtendedProfilePage extends ProfilePage {
  // Additional elements for comprehensive testing
  readonly roleDisplay: Locator;
  readonly editButton: Locator;
  readonly profilePicture: Locator;
  readonly uploadPictureButton: Locator;
  readonly removePictureButton: Locator;
  readonly profileCompletionIndicator: Locator;

  // Email change elements
  readonly newEmailInput: Locator;
  readonly emailChangeButton: Locator;
  readonly pendingEmailNotice: Locator;

  // Password change elements
  readonly currentPasswordField: Locator;
  readonly confirmPasswordInput: Locator;

  // Notification settings
  readonly saveNotificationButton: Locator;

  // Privacy settings
  readonly profileVisibilitySelect: Locator;
  readonly showEmailToggle: Locator;
  readonly savePrivacyButton: Locator;

  // Security settings
  readonly activeSessionsList: Locator;
  readonly currentSessionIndicator: Locator;
  readonly sessionInfo: Locator;
  readonly logoutAllButton: Locator;
  readonly enable2FAButton: Locator;
  readonly qrCode: Locator;
  readonly backupCodes: Locator;
  readonly twoFactorCode: Locator;

  // Data settings
  readonly dataExportButton: Locator;
  readonly dataExportStatus: Locator;

  // Account deletion
  readonly deletionReason: Locator;
  readonly deletionPassword: Locator;
  readonly confirmDeletionButton: Locator;

  constructor(page: Page) {
    super(page);

    // Additional elements for comprehensive testing
    this.roleDisplay = this.page.locator('[data-testid="role-display"]');
    this.editButton = this.page.locator('[data-testid="edit-profile-button"]');
    this.profilePicture = this.page.locator('[data-testid="profile-picture"]');
    this.uploadPictureButton = this.page.locator('[data-testid="upload-picture-button"]');
    this.removePictureButton = this.page.locator('[data-testid="remove-picture-button"]');
    this.profileCompletionIndicator = this.page.locator('[data-testid="profile-completion"]');

    // Email change
    this.newEmailInput = this.page.locator('[data-testid="new-email-input"]');
    this.emailChangeButton = this.page.locator('[data-testid="change-email-button"]');
    this.pendingEmailNotice = this.page.locator('[data-testid="pending-email-notice"]');

    // Password change
    this.currentPasswordField = this.page.locator('[data-testid="current-password-field"]');
    this.confirmPasswordInput = this.page.locator('[data-testid="confirm-password-input"]');

    // Notification settings
    this.saveNotificationButton = this.page.locator('[data-testid="save-notifications-button"]');

    // Privacy settings
    this.profileVisibilitySelect = this.page.locator('[data-testid="profile-visibility-select"]');
    this.showEmailToggle = this.page.locator('[data-testid="show-email-toggle"]');
    this.savePrivacyButton = this.page.locator('[data-testid="save-privacy-button"]');

    // Security settings
    this.activeSessionsList = this.page.locator('[data-testid="active-sessions-list"]');
    this.currentSessionIndicator = this.page.locator('[data-testid="current-session"]');
    this.sessionInfo = this.page.locator('[data-testid="session-info"]');
    this.logoutAllButton = this.page.locator('[data-testid="logout-all-devices"]');
    this.enable2FAButton = this.page.locator('[data-testid="enable-2fa-button"]');
    this.qrCode = this.page.locator('[data-testid="qr-code"]');
    this.backupCodes = this.page.locator('[data-testid="backup-codes"]');
    this.twoFactorCode = this.page.locator('[data-testid="2fa-code-input"]');

    // Data settings
    this.dataExportButton = this.page.locator('[data-testid="export-data-button"]');
    this.dataExportStatus = this.page.locator('[data-testid="export-status"]');

    // Account deletion
    this.deletionReason = this.page.locator('[data-testid="deletion-reason"]');
    this.deletionPassword = this.page.locator('[data-testid="deletion-password"]');
    this.confirmDeletionButton = this.page.locator('[data-testid="confirm-deletion"]');
  }

  async assertProfileFormVisible(): Promise<void> {
    await expect(this.profileForm).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.firstNameInput).toBeVisible();
    await expect(this.lastNameInput).toBeVisible();
  }

  async enableEditMode(): Promise<void> {
    await this.editButton.click();
    await expect(this.saveButton).toBeVisible();
  }

  async assertEditModeEnabled(): Promise<void> {
    await expect(this.saveButton).toBeVisible();
    await expect(this.cancelButton).toBeVisible();
  }

  async assertEditModeDisabled(): Promise<void> {
    await expect(this.editButton).toBeVisible();
    await expect(this.saveButton).not.toBeVisible();
  }

  async updateProfile(data: { firstName?: string; lastName?: string; username?: string }): Promise<void> {
    if (data.firstName) {
      await this.fillFirstName(data.firstName);
    }
    if (data.lastName) {
      await this.fillLastName(data.lastName);
    }
    if (data.username) {
      await this.fillUsername(data.username);
    }
  }

  async fillFirstName(firstName: string): Promise<void> {
    await this.firstNameInput.clear();
    await this.firstNameInput.fill(firstName);
  }

  async fillLastName(lastName: string): Promise<void> {
    await this.lastNameInput.clear();
    await this.lastNameInput.fill(lastName);
  }

  async fillUsername(username: string): Promise<void> {
    await this.usernameInput.clear();
    await this.usernameInput.fill(username);
  }

  async clearProfileForm(): Promise<void> {
    await this.firstNameInput.clear();
    await this.lastNameInput.clear();
    await this.usernameInput.clear();
  }

  async cancelEdit(): Promise<void> {
    await this.cancelButton.click();
  }

  async uploadProfilePicture(filePath: string): Promise<void> {
    await this.uploadPictureButton.setInputFiles(filePath);
  }

  async removeProfilePicture(): Promise<void> {
    await this.removePictureButton.click();
  }

  // Email change methods
  async navigateToEmailChange(): Promise<void> {
    await this.page.click('[data-testid="email-settings-tab"]');
    await expect(this.newEmailInput).toBeVisible();
  }

  async changeEmail(newEmail: string, password: string): Promise<void> {
    await this.fillNewEmail(newEmail);
    await this.fillCurrentPassword(password);
    await this.submitEmailChange();
  }

  async fillNewEmail(email: string): Promise<void> {
    await this.newEmailInput.clear();
    await this.newEmailInput.fill(email);
  }

  async fillCurrentPassword(password: string): Promise<void> {
    await this.currentPasswordInput.clear();
    await this.currentPasswordInput.fill(password);
  }

  async submitEmailChange(): Promise<void> {
    await this.emailChangeButton.click();
  }

  async assertPasswordValidationError(message?: string): Promise<void> {
    const errorElement = this.page.locator('[data-testid="password-validation-error"]');
    await expect(errorElement).toBeVisible();
    if (message) {
      await expect(errorElement).toContainText(message);
    }
  }

  // Password change methods
  async navigateToPasswordChange(): Promise<void> {
    await this.page.click('[data-testid="password-settings-tab"]');
    await expect(this.currentPasswordField).toBeVisible();
  }

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    await this.fillCurrentPasswordField(currentPassword);
    await this.fillNewPassword(newPassword);
    await this.fillConfirmPassword(confirmPassword);
    await this.submitPasswordChange();
  }

  async fillCurrentPasswordField(password: string): Promise<void> {
    await this.currentPasswordField.clear();
    await this.currentPasswordField.fill(password);
  }

  async fillNewPassword(password: string): Promise<void> {
    await this.newPasswordInput.clear();
    await this.newPasswordInput.fill(password);
  }

  async fillConfirmPassword(password: string): Promise<void> {
    await this.confirmPasswordInput.clear();
    await this.confirmPasswordInput.fill(password);
  }

  async clearPasswordForm(): Promise<void> {
    await this.currentPasswordField.clear();
    await this.newPasswordInput.clear();
    await this.confirmPasswordInput.clear();
  }

  async submitPasswordChange(): Promise<void> {
    await this.changePasswordButton.click();
  }

  // Notification settings methods
  async navigateToNotificationSettings(): Promise<void> {
    await this.page.click('[data-testid="notifications-tab"]');
    await expect(this.emailNotificationsToggle).toBeVisible();
  }

  async toggleEmailNotifications(enabled: boolean): Promise<void> {
    const isChecked = await this.emailNotificationsToggle.isChecked();
    if (isChecked !== enabled) {
      await this.emailNotificationsToggle.click();
    }
  }

  async togglePushNotifications(enabled: boolean): Promise<void> {
    const isChecked = await this.smsNotificationsToggle.isChecked();
    if (isChecked !== enabled) {
      await this.smsNotificationsToggle.click();
    }
  }

  async saveNotificationSettings(): Promise<void> {
    await this.saveNotificationButton.click();
  }

  // Privacy settings methods
  async navigateToPrivacySettings(): Promise<void> {
    await this.page.click('[data-testid="privacy-tab"]');
    await expect(this.profileVisibilitySelect).toBeVisible();
  }

  async setProfileVisibility(visibility: string): Promise<void> {
    await this.profileVisibilitySelect.selectOption(visibility);
  }

  async toggleShowEmail(enabled: boolean): Promise<void> {
    const isChecked = await this.showEmailToggle.isChecked();
    if (isChecked !== enabled) {
      await this.showEmailToggle.click();
    }
  }

  async savePrivacySettings(): Promise<void> {
    await this.savePrivacyButton.click();
  }

  // Security settings methods
  async navigateToSecuritySettings(): Promise<void> {
    await this.page.click('[data-testid="security-tab"]');
    await expect(this.activeSessionsList).toBeVisible();
  }

  async revokeSession(sessionIndex: number): Promise<void> {
    const session = this.sessionInfo.nth(sessionIndex);
    await session.locator('[data-testid="revoke-session"]').click();
  }

  async logoutAllDevices(): Promise<void> {
    await this.logoutAllButton.click();
    await this.page.click('[data-testid="confirm-logout-all"]');
  }

  async enable2FA(): Promise<void> {
    await this.enable2FAButton.click();
  }

  async verify2FA(code: string): Promise<void> {
    await this.twoFactorCode.fill(code);
    await this.page.click('[data-testid="verify-2fa-button"]');
  }

  // Data settings methods
  async navigateToDataSettings(): Promise<void> {
    await this.page.click('[data-testid="data-tab"]');
    await expect(this.dataExportButton).toBeVisible();
  }

  async requestDataExport(): Promise<void> {
    await this.dataExportButton.click();
  }

  // Account deletion methods
  async navigateToAccountDeletion(): Promise<void> {
    await this.page.click('[data-testid="danger-zone-tab"]');
    await expect(this.deleteAccountButton).toBeVisible();
  }

  async requestAccountDeletion(password: string, reason: string): Promise<void> {
    await this.deleteAccountButton.click();
    await this.fillDeletionReason(reason);
    await this.fillDeletionPassword(password);
    await this.submitAccountDeletion();
  }

  async fillDeletionReason(reason: string): Promise<void> {
    await this.deletionReason.fill(reason);
  }

  async fillDeletionPassword(password: string): Promise<void> {
    await this.deletionPassword.fill(password);
  }

  async submitAccountDeletion(): Promise<void> {
    await this.confirmDeletionButton.click();
  }
}