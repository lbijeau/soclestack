import { test, expect } from '@playwright/test';
import { ExtendedProfilePage as ProfilePage } from '../../pages/ExtendedProfilePage';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { TestDataFactory } from '../../utils/test-data-factory';

test.describe('Profile Management', () => {
  let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    profilePage = new ProfilePage(page);

    // Ensure test users exist
    await DatabaseHelpers.setupTestUsers();

    // Login as regular user
    await AuthHelpers.loginAsUser(page);
  });

  test.afterEach(async ({ page }) => {
    // Logout after each test
    try {
      await AuthHelpers.logout(page);
    } catch {
      // Ignore logout errors in cleanup
    }
  });

  test.describe('Profile Viewing', () => {
    test('should display current user profile information', async ({ page }) => {
      await profilePage.goto();

      await test.step('Verify profile form is visible', async () => {
        await profilePage.assertProfileFormVisible();
      });

      await test.step('Verify current user data is displayed', async () => {
        const user = await DatabaseHelpers.findUserByEmail('user@test.com');

        await expect(profilePage.emailInput).toHaveValue(user.email);
        await expect(profilePage.firstNameInput).toHaveValue(user.firstName || '');
        await expect(profilePage.lastNameInput).toHaveValue(user.lastName || '');
        await expect(profilePage.usernameInput).toHaveValue(user.username || '');
      });

      await test.step('Verify read-only fields are disabled', async () => {
        await expect(profilePage.emailInput).toBeDisabled();
        await expect(profilePage.roleDisplay).toContainText('USER');
      });
    });

    test('should show profile completion status', async ({ page }) => {
      await profilePage.goto();

      await test.step('Check profile completion indicator', async () => {
        await expect(profilePage.profileCompletionIndicator).toBeVisible();

        // Profile should show completion percentage
        const completionText = await profilePage.profileCompletionIndicator.textContent();
        expect(completionText).toMatch(/\d+%/);
      });
    });
  });

  test.describe('Profile Editing', () => {
    test('should update profile information successfully', async ({ page }) => {
      const updateData = TestDataFactory.createFormData().validProfileUpdateData;

      await profilePage.goto();

      await test.step('Enable edit mode', async () => {
        await profilePage.enableEditMode();
        await profilePage.assertEditModeEnabled();
      });

      await test.step('Update profile information', async () => {
        await profilePage.updateProfile(updateData);
      });

      await test.step('Save changes', async () => {
        await profilePage.saveProfile();
        await profilePage.assertSuccessMessage('Profile updated successfully');
      });

      await test.step('Verify changes are persisted', async () => {
        await page.reload();
        await profilePage.waitForProfileToLoad();

        if (updateData.firstName) {
          await expect(profilePage.firstNameInput).toHaveValue(updateData.firstName);
        }
        if (updateData.lastName) {
          await expect(profilePage.lastNameInput).toHaveValue(updateData.lastName);
        }
        if (updateData.username) {
          await expect(profilePage.usernameInput).toHaveValue(updateData.username);
        }
      });

      await test.step('Verify database is updated', async () => {
        const updatedUser = await DatabaseHelpers.findUserByEmail('user@test.com');
        if (updateData.firstName) expect(updatedUser.firstName).toBe(updateData.firstName);
        if (updateData.lastName) expect(updatedUser.lastName).toBe(updateData.lastName);
        if (updateData.username) expect(updatedUser.username).toBe(updateData.username);
      });
    });

    test('should validate profile update data', async ({ page }) => {
      await profilePage.goto();
      await profilePage.enableEditMode();

      const invalidData = TestDataFactory.createFormData().invalidProfileUpdateData;

      for (const data of invalidData) {
        await test.step(`Test invalid profile data: ${JSON.stringify(data)}`, async () => {
          // Clear form first
          await profilePage.clearProfileForm();

          // Fill with invalid data
          if (data.firstName !== undefined) {
            await profilePage.fillFirstName(data.firstName);
          }
          if (data.lastName !== undefined) {
            await profilePage.fillLastName(data.lastName);
          }
          if (data.username !== undefined) {
            await profilePage.fillUsername(data.username);
          }

          await profilePage.saveProfile();

          // Should show validation errors
          const hasValidationError = await page.locator('[data-testid*="validation-error"]').first().isVisible({ timeout: 2000 });
          expect(hasValidationError).toBe(true);
        });
      }
    });

    test('should cancel profile changes', async ({ page }) => {
      const originalUser = await DatabaseHelpers.findUserByEmail('user@test.com');

      await profilePage.goto();
      await profilePage.enableEditMode();

      await test.step('Make changes to profile', async () => {
        await profilePage.fillFirstName('Changed Name');
        await profilePage.fillLastName('Changed Last');
      });

      await test.step('Cancel changes', async () => {
        await profilePage.cancelEdit();
        await profilePage.assertEditModeDisabled();
      });

      await test.step('Verify original data is restored', async () => {
        await expect(profilePage.firstNameInput).toHaveValue(originalUser.firstName || '');
        await expect(profilePage.lastNameInput).toHaveValue(originalUser.lastName || '');
      });
    });

    test('should prevent saving with duplicate username', async ({ page }) => {
      // Create another user with a known username
      await DatabaseHelpers.createTestUser({
        email: 'other@test.com',
        username: 'existinguser',
      });

      await profilePage.goto();
      await profilePage.enableEditMode();

      await test.step('Try to use existing username', async () => {
        await profilePage.fillUsername('existinguser');
        await profilePage.saveProfile();

        await profilePage.assertErrorMessage('Username already exists');
      });
    });
  });

  test.describe('Email Change', () => {
    test('should initiate email change process', async ({ page }) => {
      const newEmail = `newemail${Date.now()}@test.com`;

      await profilePage.goto();
      await profilePage.navigateToEmailChange();

      await test.step('Request email change', async () => {
        await profilePage.changeEmail(newEmail, 'UserTest123!');
        await profilePage.assertSuccessMessage('Verification email sent to new address');
      });

      await test.step('Verify email change is pending', async () => {
        await expect(profilePage.pendingEmailNotice).toBeVisible();
        await expect(profilePage.pendingEmailNotice).toContainText(newEmail);
      });

      await test.step('Verify user email is not changed yet', async () => {
        const user = await DatabaseHelpers.findUserByEmail('user@test.com');
        expect(user.email).toBe('user@test.com');
      });
    });

    test('should require current password for email change', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToEmailChange();

      await test.step('Try to change email without password', async () => {
        await profilePage.fillNewEmail('newemail@test.com');
        await profilePage.submitEmailChange();

        await profilePage.assertPasswordValidationError('Current password is required');
      });

      await test.step('Try with wrong password', async () => {
        await profilePage.fillCurrentPassword('wrongpassword');
        await profilePage.submitEmailChange();

        await profilePage.assertErrorMessage('Invalid password');
      });
    });

    test('should prevent duplicate email changes', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToEmailChange();

      await test.step('Try to change to existing email', async () => {
        await profilePage.changeEmail('admin@test.com', 'UserTest123!');
        await profilePage.assertErrorMessage('Email already exists');
      });
    });
  });

  test.describe('Password Change', () => {
    test('should change password successfully', async ({ page }) => {
      const newPassword = TestDataFactory.generateValidPassword();

      await profilePage.goto();
      await profilePage.navigateToPasswordChange();

      await test.step('Change password', async () => {
        await profilePage.changePassword('UserTest123!', newPassword, newPassword);
        await profilePage.assertSuccessMessage('Password changed successfully');
      });

      await test.step('Verify can login with new password', async () => {
        await AuthHelpers.logout(page);
        await AuthHelpers.authenticateUser(page, 'user@test.com', newPassword);
        await expect(page).toHaveURL(/.*\/dashboard/);
      });

      await test.step('Verify cannot login with old password', async () => {
        await AuthHelpers.logout(page);

        try {
          await AuthHelpers.authenticateUser(page, 'user@test.com', 'UserTest123!');
          throw new Error('Should not be able to login with old password');
        } catch (error) {
          // Expected to fail
          expect(page.url()).toContain('/login');
        }
      });
    });

    test('should validate password change form', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToPasswordChange();

      const invalidData = TestDataFactory.createFormData().invalidPasswordChangeData;

      for (const data of invalidData) {
        await test.step(`Test password change validation: ${JSON.stringify(data)}`, async () => {
          await profilePage.clearPasswordForm();

          if (data.currentPassword !== undefined) {
            await profilePage.fillCurrentPassword(data.currentPassword);
          }
          if (data.newPassword !== undefined) {
            await profilePage.fillNewPassword(data.newPassword);
          }
          if (data.confirmPassword !== undefined) {
            await profilePage.fillConfirmPassword(data.confirmPassword);
          }

          await profilePage.submitPasswordChange();

          // Should show validation error
          const hasError = await page.locator('[data-testid*="validation-error"], [data-testid="error-message"]').first().isVisible({ timeout: 2000 });
          expect(hasError).toBe(true);
        });
      }
    });

    test('should enforce password strength requirements', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToPasswordChange();

      const weakPasswords = ['123456', 'password', 'qwerty'];

      for (const weakPassword of weakPasswords) {
        await test.step(`Test weak password: ${weakPassword}`, async () => {
          await profilePage.fillCurrentPassword('UserTest123!');
          await profilePage.fillNewPassword(weakPassword);
          await profilePage.fillConfirmPassword(weakPassword);

          await profilePage.submitPasswordChange();

          await expect(page.locator('[data-testid="password-strength-error"]')).toBeVisible();
        });
      }
    });
  });

  test.describe('Profile Picture', () => {
    test('should upload profile picture', async ({ page }) => {
      await profilePage.goto();

      await test.step('Upload new profile picture', async () => {
        // Create a test image file (this would normally be a real file)
        const testImagePath = '/home/luc-bijeau/Projects/soclestack/tests/fixtures/test-avatar.png';

        await profilePage.uploadProfilePicture(testImagePath);
        await profilePage.assertSuccessMessage('Profile picture updated');
      });

      await test.step('Verify profile picture is displayed', async () => {
        await expect(profilePage.profilePicture).toBeVisible();
        await expect(profilePage.profilePicture).toHaveAttribute('src', /.*\/uploads\/.*/);
      });
    });

    test('should validate profile picture upload', async ({ page }) => {
      await profilePage.goto();

      await test.step('Try to upload invalid file type', async () => {
        // This would be a text file instead of image
        const invalidFilePath = '/home/luc-bijeau/Projects/soclestack/tests/fixtures/test-document.txt';

        await profilePage.uploadProfilePicture(invalidFilePath);
        await profilePage.assertErrorMessage('Invalid file type');
      });
    });

    test('should remove profile picture', async ({ page }) => {
      await profilePage.goto();

      // First upload a picture
      const testImagePath = '/home/luc-bijeau/Projects/soclestack/tests/fixtures/test-avatar.png';
      await profilePage.uploadProfilePicture(testImagePath);

      await test.step('Remove profile picture', async () => {
        await profilePage.removeProfilePicture();
        await profilePage.assertSuccessMessage('Profile picture removed');
      });

      await test.step('Verify default avatar is shown', async () => {
        await expect(profilePage.profilePicture).toHaveAttribute('src', /.*default-avatar.*/);
      });
    });
  });

  test.describe('Account Settings', () => {
    test('should update notification preferences', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToNotificationSettings();

      await test.step('Update notification preferences', async () => {
        await profilePage.toggleEmailNotifications(false);
        await profilePage.togglePushNotifications(true);
        await profilePage.saveNotificationSettings();

        await profilePage.assertSuccessMessage('Notification preferences updated');
      });

      await test.step('Verify settings are persisted', async () => {
        await page.reload();
        await profilePage.navigateToNotificationSettings();

        await expect(profilePage.emailNotificationsToggle).not.toBeChecked();
        await expect(profilePage.pushNotificationsToggle).toBeChecked();
      });
    });

    test('should update privacy settings', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToPrivacySettings();

      await test.step('Update privacy settings', async () => {
        await profilePage.setProfileVisibility('private');
        await profilePage.toggleShowEmail(false);
        await profilePage.savePrivacySettings();

        await profilePage.assertSuccessMessage('Privacy settings updated');
      });

      await test.step('Verify settings are saved', async () => {
        await page.reload();
        await profilePage.navigateToPrivacySettings();

        await expect(profilePage.profileVisibilitySelect).toHaveValue('private');
        await expect(profilePage.showEmailToggle).not.toBeChecked();
      });
    });
  });

  test.describe('Account Security', () => {
    test('should view active sessions', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToSecuritySettings();

      await test.step('Verify current session is listed', async () => {
        await expect(profilePage.activeSessionsList).toBeVisible();
        await expect(profilePage.currentSessionIndicator).toBeVisible();
      });

      await test.step('Verify session details are shown', async () => {
        const sessionInfo = profilePage.sessionInfo.first();
        await expect(sessionInfo.locator('[data-testid="session-device"]')).toBeVisible();
        await expect(sessionInfo.locator('[data-testid="session-location"]')).toBeVisible();
        await expect(sessionInfo.locator('[data-testid="session-last-active"]')).toBeVisible();
      });
    });

    test('should revoke individual sessions', async ({ browser, page }) => {
      // Create a second session
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await AuthHelpers.loginAsUser(page2);

      await test.step('View sessions from first browser', async () => {
        await profilePage.goto();
        await profilePage.navigateToSecuritySettings();

        // Should see multiple sessions
        const sessionCount = await profilePage.sessionInfo.count();
        expect(sessionCount).toBeGreaterThan(1);
      });

      await test.step('Revoke other session', async () => {
        await profilePage.revokeSession(1); // Revoke second session
        await profilePage.assertSuccessMessage('Session revoked');
      });

      await test.step('Verify other session is terminated', async () => {
        await page2.reload();
        await expect(page2).toHaveURL(/.*\/login/);
      });

      await context2.close();
    });

    test('should logout from all devices', async ({ browser, page }) => {
      // Create multiple sessions
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await AuthHelpers.loginAsUser(page2);

      await test.step('Logout from all devices', async () => {
        await profilePage.goto();
        await profilePage.navigateToSecuritySettings();
        await profilePage.logoutAllDevices();

        await profilePage.assertSuccessMessage('Logged out from all devices');
      });

      await test.step('Verify all sessions are terminated', async () => {
        // Current page should redirect to login
        await expect(page).toHaveURL(/.*\/login/);

        // Other session should also be terminated
        await page2.reload();
        await expect(page2).toHaveURL(/.*\/login/);
      });

      await context2.close();
    });

    test('should enable two-factor authentication', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToSecuritySettings();

      await test.step('Enable 2FA', async () => {
        await profilePage.enable2FA();

        // Should show QR code and backup codes
        await expect(profilePage.qrCode).toBeVisible();
        await expect(profilePage.backupCodes).toBeVisible();
      });

      await test.step('Verify 2FA setup', async () => {
        // Enter verification code (would normally be from authenticator app)
        const testCode = '123456'; // This would be a real TOTP code in practice
        await profilePage.verify2FA(testCode);

        await profilePage.assertSuccessMessage('Two-factor authentication enabled');
      });
    });
  });

  test.describe('Data Export', () => {
    test('should request user data export', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToDataSettings();

      await test.step('Request data export', async () => {
        await profilePage.requestDataExport();
        await profilePage.assertSuccessMessage('Data export request submitted');
      });

      await test.step('Verify export status is shown', async () => {
        await expect(profilePage.dataExportStatus).toBeVisible();
        await expect(profilePage.dataExportStatus).toContainText('Processing');
      });
    });
  });

  test.describe('Account Deletion', () => {
    test('should initiate account deletion process', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToAccountDeletion();

      await test.step('Request account deletion', async () => {
        await profilePage.requestAccountDeletion('UserTest123!', 'I no longer need this account');
        await profilePage.assertSuccessMessage('Account deletion request submitted');
      });

      await test.step('Verify account is marked for deletion', async () => {
        const user = await DatabaseHelpers.findUserByEmail('user@test.com');
        expect(user.deletionRequestedAt).toBeTruthy();
      });
    });

    test('should require password confirmation for deletion', async ({ page }) => {
      await profilePage.goto();
      await profilePage.navigateToAccountDeletion();

      await test.step('Try to delete without password', async () => {
        await profilePage.fillDeletionReason('Test reason');
        await profilePage.submitAccountDeletion();

        await profilePage.assertPasswordValidationError('Password is required');
      });

      await test.step('Try with wrong password', async () => {
        await profilePage.fillDeletionPassword('wrongpassword');
        await profilePage.submitAccountDeletion();

        await profilePage.assertErrorMessage('Invalid password');
      });
    });
  });
});