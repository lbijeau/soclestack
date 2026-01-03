'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { PasswordStrengthMeter } from '@/components/ui/password-strength-meter';
import { ChangePasswordInput } from '@/lib/validations';
import { AuthError } from '@/types/auth';
import { apiPatch } from '@/lib/api-client';

export function PasswordChangeForm() {
  const [formData, setFormData] = useState<ChangePasswordInput>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    setErrors({});

    try {
      const response = await apiPatch('/api/users/profile', formData);

      const data = await response.json();

      if (!response.ok) {
        const authError = data.error as AuthError;
        if (authError.type === 'VALIDATION_ERROR' && authError.details) {
          setErrors(authError.details);
        } else {
          setError(authError.message);
        }
        return;
      }

      setSuccess(data.message);

      // Reset form on success
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: [] }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {success && <Alert variant="success">{success}</Alert>}

      <div className="space-y-2">
        <label
          htmlFor="currentPassword"
          className="text-sm font-medium text-gray-700"
        >
          Current Password
        </label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={formData.currentPassword}
          onChange={handleChange}
          error={!!errors.currentPassword}
          disabled={isLoading}
        />
        {errors.currentPassword && (
          <p className="text-sm text-red-600">{errors.currentPassword[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="newPassword"
          className="text-sm font-medium text-gray-700"
        >
          New Password
        </label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={formData.newPassword}
          onChange={handleChange}
          error={!!errors.newPassword}
          disabled={isLoading}
        />
        {errors.newPassword && (
          <p className="text-sm text-red-600">{errors.newPassword[0]}</p>
        )}
        <PasswordStrengthMeter password={formData.newPassword} />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-gray-700"
        >
          Confirm New Password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={formData.confirmPassword}
          onChange={handleChange}
          error={!!errors.confirmPassword}
          disabled={isLoading}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-red-600">{errors.confirmPassword[0]}</p>
        )}
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800">
              Security Notice
            </h3>
            <div className="mt-2 text-sm text-amber-700">
              <p>
                Changing your password will log you out from all other devices
                for security purposes. You&apos;ll need to sign in again on
                those devices.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Changing Password...' : 'Change Password'}
        </Button>
      </div>
    </form>
  );
}
