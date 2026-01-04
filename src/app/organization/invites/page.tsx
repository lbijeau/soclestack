'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Loader2, X, Send, Clock } from 'lucide-react';
import Link from 'next/link';

interface Invite {
  id: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export default function InvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');

  useEffect(() => {
    fetchInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInvites = async () => {
    try {
      const res = await fetch('/api/organizations/current/invites');

      if (res.status === 404) {
        router.push('/dashboard');
        return;
      }

      if (res.status === 403) {
        router.push('/organization');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch invites');

      const data = await res.json();
      setInvites(data.invites);
    } catch {
      setError('Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/organizations/current/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to send invite');
      }

      const data = await res.json();
      setInvites((prev) => [data.invite, ...prev]);
      setEmail('');
      setRole('MEMBER');
      setSuccess(`Invite sent to ${email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  const handleCancelInvite = async (inviteId: string, inviteEmail: string) => {
    if (
      !confirm(`Are you sure you want to cancel the invite to ${inviteEmail}?`)
    ) {
      return;
    }

    setCancelling(inviteId);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(
        `/api/organizations/current/invites/${inviteId}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to cancel invite');
      }

      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      setSuccess('Invite cancelled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invite');
    } finally {
      setCancelling(null);
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <Link
          href="/organization"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Organization
        </Link>
      </div>

        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
            <Mail className="h-8 w-8" />
            Invitations
          </h1>
          <p className="mt-2 text-gray-600">
            Invite new members to your organization.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Send Invite Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Invite
            </CardTitle>
            <CardDescription>
              Invite someone to join your organization via email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendInvite} className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sending}
                />
              </div>
              <div className="w-32">
                <label htmlFor="role" className="sr-only">
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as 'ADMIN' | 'MEMBER')
                  }
                  disabled={sending}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <Button type="submit" disabled={sending || !email.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Invite'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Pending Invites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invites
            </CardTitle>
            <CardDescription>
              {invites.length === 0
                ? 'No pending invitations.'
                : `${invites.length} pending invitation${invites.length !== 1 ? 's' : ''}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invites.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
                No pending invitations. Send an invite above to add team
                members.
              </p>
            ) : (
              <div className="space-y-4">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className={`flex items-center justify-between rounded-lg border p-4 ${
                      isExpired(invite.expiresAt) ? 'bg-gray-50 opacity-75' : ''
                    }`}
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {invite.email}
                      </div>
                      <div className="text-sm text-gray-500">
                        Invited by{' '}
                        {invite.invitedBy.firstName || invite.invitedBy.email}{' '}
                        on {formatDate(invite.createdAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={getRoleBadgeColor(invite.role)}>
                        {invite.role}
                      </Badge>

                      {isExpired(invite.expiresAt) ? (
                        <Badge
                          variant="outline"
                          className="border-red-200 text-red-600"
                        >
                          Expired
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-500">
                          Expires {formatDate(invite.expiresAt)}
                        </span>
                      )}

                      <Button
                        variant="outline"
                        size="icon"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() =>
                          handleCancelInvite(invite.id, invite.email)
                        }
                        disabled={cancelling === invite.id}
                      >
                        {cancelling === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
      </Card>
    </main>
  );
}
