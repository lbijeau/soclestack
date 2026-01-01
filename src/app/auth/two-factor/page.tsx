'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TwoFactorInput } from '@/components/auth/two-factor-input';
import { Loader2 } from 'lucide-react';

function TwoFactorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const returnTo = searchParams.get('returnTo') || '/dashboard';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handle2FASubmit = async (code: string, isBackupCode: boolean) => {
    if (!token) {
      router.push('/login?error=missing_token');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/2fa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingToken: token,
          code,
          isBackupCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Invalid code');
        return;
      }

      // Store tokens
      if (data.tokens) {
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
      }

      // Show warning if low on backup codes
      if (data.warnings?.lowBackupCodes) {
        alert(
          `Warning: You only have ${data.warnings.remainingBackupCodes} backup codes remaining. Consider regenerating them.`
        );
      }

      router.push(returnTo);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/login');
  };

  if (!token) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Verify your identity to complete sign in
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TwoFactorInput
          onSubmit={handle2FASubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
          error={error}
        />
      </CardContent>
    </Card>
  );
}

export default function TwoFactorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <Suspense
          fallback={
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </CardContent>
            </Card>
          }
        >
          <TwoFactorContent />
        </Suspense>
      </div>
    </div>
  );
}
