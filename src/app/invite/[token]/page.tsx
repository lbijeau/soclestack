'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Loader2,
  CheckCircle,
  XCircle,
  LogIn,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';

interface InviteDetails {
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  expiresAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  invitedBy: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    fetchInvite();
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchInvite = async () => {
    try {
      const res = await fetch(`/api/invites/${token}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Invalid invite');
      }

      const data = await res.json();
      setInvite(data.invite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invite');
    } finally {
      setLoading(false);
    }
  };

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setIsLoggedIn(!!data.isLoggedIn);
        setUserEmail(data.email || '');
      }
    } catch {
      // Not logged in
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError('');

    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to accept invite');
      }

      // Redirect to organization page
      router.push('/organization');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
      setAccepting(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button variant="outline">Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  const emailMismatch =
    isLoggedIn && userEmail.toLowerCase() !== invite.email.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>You&apos;re Invited!</CardTitle>
          <CardDescription>
            {invite.invitedBy} has invited you to join
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Organization Info */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {invite.organization.name}
            </h2>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-gray-500">You will join as</span>
              <Badge className={getRoleBadgeColor(invite.role)}>
                {invite.role}
              </Badge>
            </div>
          </div>

          {/* Invite Email */}
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-500">Invite sent to</p>
            <p className="font-medium">{invite.email}</p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions based on login state */}
          {isLoggedIn ? (
            emailMismatch ? (
              <div className="space-y-4">
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  You are logged in as <strong>{userEmail}</strong>, but this
                  invite was sent to <strong>{invite.email}</strong>. Please log
                  in with the correct account.
                </div>
                <Link
                  href={`/login?returnUrl=/invite/${token}`}
                  className="block"
                >
                  <Button variant="outline" className="w-full">
                    <LogIn className="mr-2 h-4 w-4" />
                    Log in with different account
                  </Button>
                </Link>
              </div>
            ) : (
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full"
              >
                {accepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Accept Invitation
                  </>
                )}
              </Button>
            )
          ) : (
            <div className="space-y-3">
              <Link href={`/register?invite=${token}`} className="block">
                <Button className="w-full">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account & Join
                </Button>
              </Link>
              <Link
                href={`/login?returnUrl=/invite/${token}`}
                className="block"
              >
                <Button variant="outline" className="w-full">
                  <LogIn className="mr-2 h-4 w-4" />
                  Already have an account? Log in
                </Button>
              </Link>
            </div>
          )}

          {/* Expiry info */}
          <p className="text-center text-sm text-gray-500">
            This invitation expires on{' '}
            {new Date(invite.expiresAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
