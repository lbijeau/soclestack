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
import { Loader2 } from 'lucide-react';

interface OAuthProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

function OAuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [profile, setProfile] = useState<OAuthProfile | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [useInvite, setUseInvite] = useState(false);
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
        if (payload.inviteToken) {
          setInviteToken(payload.inviteToken);
          setUseInvite(true);
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
      const response = await fetch('/api/auth/oauth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          organizationName: useInvite ? undefined : organizationName,
          inviteToken: useInvite ? inviteToken : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Registration failed');
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

  if (!token) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Details</CardTitle>
        <CardDescription>
          {profile?.email ? (
            <>
              You&apos;re signing up as <strong>{profile.email}</strong>
            </>
          ) : (
            'Complete your account setup'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          {profile && (
            <div className="space-y-2 border-b pb-4">
              <div className="text-sm">
                <span className="text-gray-500">Name:</span>{' '}
                <span className="font-medium">
                  {[profile.firstName, profile.lastName]
                    .filter(Boolean)
                    .join(' ') || 'Not provided'}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Email:</span>{' '}
                <span className="font-medium">{profile.email}</span>
              </div>
            </div>
          )}

          {!inviteToken && (
            <div className="flex gap-4 py-2">
              <button
                type="button"
                onClick={() => setUseInvite(false)}
                className={`flex-1 rounded-md border px-4 py-2 text-sm ${
                  !useInvite
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Create Organization
              </button>
              <button
                type="button"
                onClick={() => setUseInvite(true)}
                className={`flex-1 rounded-md border px-4 py-2 text-sm ${
                  useInvite
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Use Invite Code
              </button>
            </div>
          )}

          {useInvite ? (
            <div className="space-y-2">
              <label htmlFor="inviteToken" className="text-sm font-medium">
                Invite Code
              </label>
              <Input
                id="inviteToken"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Enter your invite code"
                disabled={isLoading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="organizationName" className="text-sm font-medium">
                Organization Name
              </label>
              <Input
                id="organizationName"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Enter your organization name"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                You&apos;ll be the owner of this organization.
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              isLoading ||
              (!useInvite && !organizationName) ||
              (useInvite && !inviteToken)
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Complete Registration'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function OAuthCompletePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Complete Your Registration
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Just one more step to create your account
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
          <OAuthCompleteContent />
        </Suspense>
      </div>
    </div>
  );
}
