'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Unlock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

function UnlockAccountContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<
    'loading' | 'success' | 'error' | 'no-token'
  >('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    verifyUnlock();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const verifyUnlock = async () => {
    try {
      const response = await fetch('/api/auth/verify-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(data.error?.message || 'Failed to unlock account');
        return;
      }

      setStatus('success');
      setMessage(data.message);
    } catch {
      setStatus('error');
      setMessage('An unexpected error occurred');
    }
  };

  if (status === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8"
        data-testid="unlock-loading"
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-600" />
              <p className="text-gray-600">Unlocking your account...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'no-token') {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8"
        data-testid="unlock-no-token"
      >
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <Unlock className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle
              className="mt-4 text-center"
              data-testid="no-token-title"
            >
              Invalid Link
            </CardTitle>
            <CardDescription className="text-center">
              This unlock link appears to be invalid or incomplete.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/request-unlock">
              <Button className="w-full" data-testid="request-new-link-button">
                Request New Unlock Link
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8"
        data-testid="unlock-error"
      >
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="mt-4 text-center" data-testid="error-title">
              Unlock Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="error" className="mb-4" data-testid="error-message">
              {message}
            </Alert>
            <div className="space-y-3">
              <Link href="/request-unlock">
                <Button
                  className="w-full"
                  data-testid="request-new-link-button"
                >
                  Request New Unlock Link
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full"
                  data-testid="back-to-login-button"
                >
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8"
      data-testid="unlock-success"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="mt-4 text-center" data-testid="success-title">
            Account Unlocked!
          </CardTitle>
          <CardDescription
            className="text-center"
            data-testid="success-message"
          >
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button className="w-full" data-testid="sign-in-button">
              Sign In Now
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
}

export default function UnlockAccountPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <UnlockAccountContent />
    </Suspense>
  );
}
