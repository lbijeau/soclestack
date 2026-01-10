import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for 2FA challenge page (/auth/two-factor)
 */
export class TwoFactorPage extends BasePage {
  // Challenge page elements
  readonly codeInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly useBackupCodeLink: Locator;
  readonly backupCodeInput: Locator;
  readonly useAuthenticatorLink: Locator;

  constructor(page: Page) {
    super(page);

    this.codeInput = this.page.locator(
      '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
    );
    this.submitButton = this.page.locator(
      '[data-testid="2fa-submit"], button:has-text("Verify")'
    );
    this.cancelButton = this.page.locator(
      '[data-testid="2fa-cancel"], button:has-text("Cancel")'
    );
    this.useBackupCodeLink = this.page.locator(
      '[data-testid="use-backup-code"], button:has-text("Use backup code")'
    );
    this.backupCodeInput = this.page.locator('[data-testid="backup-code-input"]');
    this.useAuthenticatorLink = this.page.locator(
      '[data-testid="use-authenticator"], button:has-text("Use authenticator")'
    );
  }

  /**
   * Navigate to 2FA page with token
   */
  async goto(token: string, returnTo: string = '/dashboard'): Promise<void> {
    await this.navigateTo(
      `/auth/two-factor?token=${token}&returnTo=${encodeURIComponent(returnTo)}`
    );
    await this.waitForFormToLoad();
  }

  /**
   * Wait for 2FA form to be ready
   */
  async waitForFormToLoad(): Promise<void> {
    await expect(this.codeInput).toBeVisible({ timeout: 10000 });
  }

  /**
   * Enter TOTP code
   */
  async enterCode(code: string): Promise<void> {
    await this.codeInput.clear();
    await this.codeInput.fill(code);
  }

  /**
   * Submit the 2FA code
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Complete 2FA verification with code
   */
  async verify(code: string): Promise<void> {
    await this.enterCode(code);
    await this.submit();
  }

  /**
   * Cancel 2FA and return to login
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.page.waitForURL('**/login');
  }

  /**
   * Switch to backup code mode
   */
  async switchToBackupCode(): Promise<void> {
    await this.useBackupCodeLink.click();
    await expect(this.backupCodeInput).toBeVisible();
  }

  /**
   * Switch back to authenticator mode
   */
  async switchToAuthenticator(): Promise<void> {
    await this.useAuthenticatorLink.click();
    await expect(this.codeInput).toBeVisible();
  }

  /**
   * Enter and submit backup code
   */
  async verifyWithBackupCode(backupCode: string): Promise<void> {
    await this.switchToBackupCode();
    await this.backupCodeInput.clear();
    await this.backupCodeInput.fill(backupCode);
    await this.submit();
  }

  /**
   * Assert error message is displayed
   */
  async assertError(expectedMessage?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (expectedMessage) {
      await expect(this.errorMessage).toContainText(expectedMessage);
    }
  }

  /**
   * Assert successful verification (redirected away from 2FA page)
   */
  async assertVerificationSuccess(expectedUrl: string = '/dashboard'): Promise<void> {
    await this.page.waitForURL(`**${expectedUrl}`, { timeout: 10000 });
  }

  /**
   * Assert rate limit error
   */
  async assertRateLimitError(): Promise<void> {
    await expect(
      this.page.locator('[data-testid="rate-limit-error"], [data-testid="error-message"]')
    ).toBeVisible();
    const errorText = await this.errorMessage.textContent();
    expect(errorText?.toLowerCase()).toContain('too many');
  }
}

/**
 * Page object for 2FA setup flow (in profile/security)
 */
export class TwoFactorSetupPage extends BasePage {
  // Setup elements
  readonly setupButton: Locator;
  readonly qrCode: Locator;
  readonly manualKeyDisplay: Locator;
  readonly manualKeyToggle: Locator;
  readonly backupCodesDisplay: Locator;
  readonly copyCodesButton: Locator;
  readonly downloadCodesButton: Locator;
  readonly savedCodesButton: Locator;
  readonly verifyCodeInput: Locator;
  readonly enableButton: Locator;
  readonly cancelButton: Locator;
  readonly backButton: Locator;

  // Disable elements
  readonly disableButton: Locator;
  readonly disableCodeInput: Locator;
  readonly confirmDisableButton: Locator;

  // Status elements
  readonly twoFactorStatus: Locator;
  readonly enabledBadge: Locator;
  readonly disabledBadge: Locator;

  constructor(page: Page) {
    super(page);

    // Setup flow
    this.setupButton = this.page.locator(
      '[data-testid="2fa-setup-button"], button:has-text("Enable Two-Factor Authentication")'
    );
    this.qrCode = this.page.locator('[data-testid="2fa-qr-code"], img[alt*="QR"]');
    this.manualKeyDisplay = this.page.locator('[data-testid="manual-entry-key"], code');
    this.manualKeyToggle = this.page.locator(
      '[data-testid="manual-key-toggle"], summary:has-text("manually")'
    );
    this.backupCodesDisplay = this.page.locator('[data-testid="backup-codes"]');
    this.copyCodesButton = this.page.locator(
      '[data-testid="copy-codes-button"], button:has-text("Copy")'
    );
    this.downloadCodesButton = this.page.locator(
      '[data-testid="download-codes-button"], button:has-text("Download")'
    );
    this.savedCodesButton = this.page.locator(
      '[data-testid="saved-codes-button"], button:has-text("saved my backup")'
    );
    this.verifyCodeInput = this.page.locator(
      '[data-testid="verify-code-input"], input[pattern*="0-9"]'
    );
    this.enableButton = this.page.locator(
      '[data-testid="enable-2fa-button"], button:has-text("Enable 2FA")'
    );
    this.cancelButton = this.page.locator(
      '[data-testid="cancel-setup-button"], button:has-text("Cancel")'
    );
    this.backButton = this.page.locator(
      '[data-testid="back-button"], button:has-text("Back")'
    );

    // Disable flow
    this.disableButton = this.page.locator(
      '[data-testid="disable-2fa-button"], button:has-text("Disable")'
    );
    this.disableCodeInput = this.page.locator('[data-testid="disable-code-input"]');
    this.confirmDisableButton = this.page.locator(
      '[data-testid="confirm-disable-button"]'
    );

    // Status
    this.twoFactorStatus = this.page.locator('[data-testid="2fa-status"]');
    this.enabledBadge = this.page.locator(
      '[data-testid="2fa-enabled-badge"]'
    ).or(this.page.getByText('2FA is enabled', { exact: true }));
    // When 2FA is disabled, the UI shows the "Enable" button
    this.disabledBadge = this.page.locator(
      '[data-testid="2fa-disabled-badge"]'
    ).or(this.page.locator('button:has-text("Enable Two-Factor Authentication")'));
  }

  /**
   * Navigate to security settings where 2FA setup is located
   */
  async goto(): Promise<void> {
    await this.navigateTo('/profile/security');
  }

  /**
   * Start 2FA setup flow
   */
  async startSetup(): Promise<void> {
    console.log('Clicking setup button...');
    await this.setupButton.click();
    console.log('Button clicked, waiting for QR code...');
    // Wait a bit to see what happens to the page
    await this.page.waitForTimeout(2000);
    console.log('After 2s, current URL:', this.page.url());
    await expect(this.qrCode).toBeVisible({ timeout: 10000 });
  }

  /**
   * Get the manual entry key for TOTP
   */
  async getManualKey(): Promise<string> {
    // Click to expand if needed
    const isVisible = await this.manualKeyDisplay.isVisible();
    if (!isVisible) {
      await this.manualKeyToggle.click();
    }
    const key = await this.manualKeyDisplay.textContent();
    return key?.trim() || '';
  }

  /**
   * Get backup codes from the display
   */
  async getBackupCodes(): Promise<string[]> {
    // First, try the specific test ID for individual codes
    const codeElements = this.page.locator('[data-testid="backup-code"]');
    const count = await codeElements.count();

    if (count > 0) {
      const codes: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await codeElements.nth(i).textContent();
        if (text) {
          codes.push(text.trim());
        }
      }
      return codes;
    }

    // Fallback to container-based selection
    const codesContainer = this.page.locator(
      '[data-testid="backup-codes"] div, .backup-codes div'
    );
    const containerElements = await codesContainer.all();
    const codes: string[] = [];

    for (const element of containerElements) {
      const text = await element.textContent();
      // Match exact backup code format: uppercase A-Z (excluding I,O) + digits 2-9 (excluding 0,1)
      if (text && /^[A-HJ-NP-Z2-9]{8}$/.test(text.trim())) {
        codes.push(text.trim());
      }
    }

    return codes;
  }

  /**
   * Proceed to verification step after saving backup codes
   */
  async proceedToVerification(): Promise<void> {
    await this.savedCodesButton.click();
    await expect(this.verifyCodeInput).toBeVisible();
  }

  /**
   * Complete 2FA setup by entering verification code
   */
  async completeSetup(code: string): Promise<void> {
    await this.verifyCodeInput.clear();
    await this.verifyCodeInput.fill(code);
    await this.enableButton.click();
  }

  /**
   * Full setup flow from start to finish
   */
  async performFullSetup(generateCode: (secret: string) => string): Promise<{
    secret: string;
    backupCodes: string[];
  }> {
    await this.startSetup();

    // Get the secret
    const secret = await this.getManualKey();

    // Get backup codes
    const backupCodes = await this.getBackupCodes();

    // Proceed to verification
    await this.proceedToVerification();

    // Generate and enter code
    const code = generateCode(secret);
    await this.completeSetup(code);

    // Wait for success - the component shows enabled status instead of a message
    await this.page.waitForTimeout(1000); // Wait for state transition
    await expect(
      this.page.getByText('2FA is enabled', { exact: true })
    ).toBeVisible({ timeout: 10000 });

    return { secret, backupCodes };
  }

  /**
   * Disable 2FA (expects success - waits for UI to update)
   */
  async disable(code: string): Promise<void> {
    await this.attemptDisable(code);
    // Wait for the disable dialog to close and page to refresh
    await expect(this.disableCodeInput).not.toBeVisible({ timeout: 10000 });
    // Wait for the "Enable" button to appear (indicating 2FA is now disabled)
    await expect(this.setupButton).toBeVisible({ timeout: 10000 });
  }

  /**
   * Attempt to disable 2FA (may fail - does not wait for success)
   */
  async attemptDisable(code: string): Promise<void> {
    await this.disableButton.click();
    await expect(this.disableCodeInput).toBeVisible();
    await this.disableCodeInput.fill(code);
    await this.confirmDisableButton.click();
  }

  /**
   * Assert 2FA is enabled
   */
  async assertEnabled(): Promise<void> {
    await expect(this.enabledBadge).toBeVisible();
  }

  /**
   * Assert 2FA is disabled
   */
  async assertDisabled(): Promise<void> {
    await expect(this.disabledBadge).toBeVisible();
  }

  /**
   * Cancel setup and return
   */
  async cancelSetup(): Promise<void> {
    await this.cancelButton.click();
  }
}
