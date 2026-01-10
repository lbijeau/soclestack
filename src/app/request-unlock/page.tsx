'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Unlock, ArrowLeft, Loader2 } from 'lucide-react';

function RequestUnlockForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/request-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to send unlock request');
        return;
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8" data-testid="request-unlock-success">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Unlock className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="mt-4 text-center" data-testid="success-title">Check Your Email</CardTitle>
            <CardDescription className="text-center" data-testid="success-description">
              If your account is locked, we&apos;ve sent you an email with
              instructions to unlock it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-center text-sm text-gray-600">
              The unlock link will expire in 1 hour. If you don&apos;t see the
              email, check your spam folder.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full" data-testid="back-to-login-button">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8" data-testid="request-unlock-page">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unlock Your Account</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to unlock
            your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="error" className="mb-4" data-testid="error-message">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="request-unlock-form">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                placeholder="you@example.com"
                data-testid="email-input"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading} data-testid="submit-button">
              <Unlock className="mr-2 h-4 w-4" />
              {isLoading ? 'Sending...' : 'Send Unlock Link'}
            </Button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900"
                data-testid="back-to-login-link"
              >
                <ArrowLeft className="mr-1 inline h-3 w-3" />
                Back to Login
              </Link>
            </div>
          </form>
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

export default function RequestUnlockPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RequestUnlockForm />
    </Suspense>
  );
}
