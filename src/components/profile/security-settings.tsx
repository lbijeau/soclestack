'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { TwoFactorSetup } from './two-factor-setup';
import { apiPost } from '@/lib/api-client';

interface SecuritySettingsProps {
  twoFactorEnabled: boolean;
  isAdmin: boolean;
  remainingBackupCodes: number;
}

export function SecuritySettings({
  twoFactorEnabled,
  isAdmin,
  remainingBackupCodes,
}: SecuritySettingsProps) {
  const router = useRouter();
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSetupComplete = () => {
    setShowSetup(false);
    router.refresh();
  };

  const handleDisable = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await apiPost('/api/auth/2fa/disable', {
        code: disableCode,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to disable 2FA');
        return;
      }

      setShowDisable(false);
      setDisableCode('');
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (showSetup) {
    return (
      <TwoFactorSetup
        onComplete={handleSetupComplete}
        onCancel={() => setShowSetup(false)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && !twoFactorEnabled && (
          <Alert variant="warning">
            Two-factor authentication is required for admin accounts. Please
            enable it now.
          </Alert>
        )}

        {twoFactorEnabled ? (
          <>
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-4">
              <div>
                <p className="font-medium text-green-800">2FA is enabled</p>
                <p className="text-sm text-green-600">
                  {remainingBackupCodes} backup codes remaining
                </p>
              </div>
              <span className="text-2xl text-green-600">✓</span>
            </div>

            {remainingBackupCodes <= 3 && (
              <Alert variant="warning">
                You&apos;re running low on backup codes. Consider regenerating
                them.
              </Alert>
            )}

            {showDisable ? (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm">
                  Enter your current 2FA code to disable:
                </p>
                {error && <Alert variant="error" data-testid="error-message">{error}</Alert>}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-center text-xl tracking-widest"
                  data-testid="disable-code-input"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowDisable(false);
                      setDisableCode('');
                      setError('');
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisable}
                    disabled={isLoading || disableCode.length !== 6}
                    data-testid="confirm-disable-button"
                  >
                    {isLoading ? 'Disabling...' : 'Disable 2FA'}
                  </Button>
                </div>
              </div>
            ) : (
              !isAdmin && (
                <Button
                  variant="secondary"
                  onClick={() => setShowDisable(true)}
                  className="text-red-600 hover:text-red-700"
                >
                  Disable 2FA
                </Button>
              )
            )}

            {isAdmin && (
              <p className="text-sm text-gray-500">
                As an admin, you cannot disable two-factor authentication.
              </p>
            )}
          </>
        ) : (
          <Button onClick={() => setShowSetup(true)}>
            Enable Two-Factor Authentication
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
