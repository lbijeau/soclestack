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

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Verification failed');
        return;
      }

      setIsVerified(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8"
      data-testid={
        isVerifying
          ? 'verify-email-loading'
          : isVerified
            ? 'verify-email-success'
            : error
              ? 'verify-email-error'
              : 'verify-email-page'
      }
    >
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2
            className="mt-6 text-center text-3xl font-extrabold text-gray-900"
            data-testid="verify-email-heading"
          >
            Email Verification
          </h2>
        </div>

        <Card data-testid="verify-email-card">
          <CardHeader>
            <CardTitle data-testid="verify-email-title">
              {isVerifying
                ? 'Verifying...'
                : isVerified
                  ? 'Email Verified!'
                  : 'Verification Required'}
            </CardTitle>
            <CardDescription data-testid="verify-email-description">
              {isVerifying
                ? 'Please wait while we verify your email address.'
                : isVerified
                  ? 'Your email has been successfully verified.'
                  : 'Click the link in your email to verify your account.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="error" className="mb-4" data-testid="verify-email-error-message">
                {error}
              </Alert>
            )}

            {isVerified && (
              <div className="space-y-4" data-testid="verify-email-success-content">
                <Alert variant="success" data-testid="verify-email-success-message">
                  Your email has been verified successfully! You can now log in
                  to your account.
                </Alert>
                <Link href="/login">
                  <Button className="w-full" data-testid="continue-to-login-button">
                    Continue to Login
                  </Button>
                </Link>
              </div>
            )}

            {!token && !isVerifying && (
              <div className="text-center" data-testid="verify-email-no-token">
                <p className="mb-4 text-sm text-gray-600">
                  Please check your email for a verification link.
                </p>
                <Link href="/login">
                  <Button variant="secondary" data-testid="back-to-login-button">
                    Back to Login
                  </Button>
                </Link>
              </div>
            )}

            {error && (
              <div className="mt-4 text-center">
                <Link href="/login">
                  <Button variant="secondary" data-testid="error-back-to-login-button">
                    Back to Login
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
          <div className="w-full max-w-md space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Loading...</CardTitle>
                <CardDescription>
                  Please wait while we load the verification page.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
