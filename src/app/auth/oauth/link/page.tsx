'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Loader2, Link as LinkIcon } from 'lucide-react';

interface OAuthProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

function OAuthLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [profile, setProfile] = useState<OAuthProfile | null>(null);
  const [provider, setProvider] = useState<string>('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login?error=missing_token');
      return;
    }

    // Decode the JWT to get profile info (for display only)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.profile) {
          setProfile(payload.profile);
        }
        if (payload.provider) {
          setProvider(payload.provider);
        }
      }
    } catch {
      // If we can't decode, the server will validate
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/oauth/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to link account');
        return;
      }

      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        router.push(
          `/auth/two-factor?token=${encodeURIComponent(data.pendingToken)}&returnTo=/dashboard`
        );
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatProvider = (p: string) => {
    return p.charAt(0).toUpperCase() + p.slice(1);
  };

  if (!token) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Link {formatProvider(provider)} Account
        </CardTitle>
        <CardDescription>
          Enter your password to link your {formatProvider(provider)} account
          {profile?.email && (
            <>
              {' '}
              to <strong>{profile.email}</strong>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
            <p className="mb-1 font-medium">
              Why do I need to enter my password?
            </p>
            <p>
              To protect your account, we need to verify you own this account
              before linking a new sign-in method. This is a one-time
              verification.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !password}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking Account...
              </>
            ) : (
              'Link Account & Sign In'
            )}
          </Button>

          <div className="text-center text-sm text-gray-500">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-blue-600 hover:text-blue-500"
            >
              Cancel and go back to login
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function OAuthLinkPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Link Your Account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            An account already exists with this email
          </p>
        </div>

        <Suspense
          fallback={
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </CardContent>
            </Card>
          }
        >
          <OAuthLinkContent />
        </Suspense>
      </div>
    </div>
  );
}
