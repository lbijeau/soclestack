'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navigation/navbar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Loader2, UserMinus, Shield } from 'lucide-react';
import Link from 'next/link';

interface Member {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  organizationRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface CurrentUser {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  id: string;
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      const [membersRes, sessionRes] = await Promise.all([
        fetch('/api/organizations/current/members'),
        fetch('/api/auth/session'),
      ]);

      if (membersRes.status === 404) {
        router.push('/dashboard');
        return;
      }

      if (!membersRes.ok) throw new Error('Failed to fetch members');
      if (!sessionRes.ok) throw new Error('Failed to fetch session');

      const membersData = await membersRes.json();
      const sessionData = await sessionRes.json();

      setMembers(membersData.members);

      // Find current user's role in the members list
      const currentMember = membersData.members.find(
        (m: Member) => m.id === sessionData.userId
      );
      if (currentMember) {
        setCurrentUser({
          role: currentMember.organizationRole,
          id: currentMember.id,
        });
      }
    } catch {
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setActionLoading(memberId);
    setError('');

    try {
      const res = await fetch(
        `/api/organizations/current/members/${memberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to update role');
      }

      const data = await res.json();
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? { ...m, organizationRole: data.member.organizationRole }
            : m
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (memberId: string, memberEmail: string) => {
    if (
      !confirm(
        `Are you sure you want to remove ${memberEmail} from the organization?`
      )
    ) {
      return;
    }

    setActionLoading(memberId);
    setError('');

    try {
      const res = await fetch(
        `/api/organizations/current/members/${memberId}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to remove member');
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setActionLoading(null);
    }
  };

  const canManage =
    currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  const canManageMember = (member: Member) => {
    if (!currentUser || !canManage) return false;
    if (member.id === currentUser.id) return false; // Can't manage yourself
    if (member.organizationRole === 'OWNER') return false; // Can't manage owner
    if (currentUser.role === 'ADMIN' && member.organizationRole === 'ADMIN')
      return false; // Admin can't manage admin
    return true;
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

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

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
              <Users className="h-8 w-8" />
              Members
            </h1>
            <p className="mt-2 text-gray-600">
              {members.length} member{members.length !== 1 ? 's' : ''} in your
              organization.
            </p>
          </div>

          {canManage && (
            <Link href="/organization/invites">
              <Button>Invite Members</Button>
            </Link>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Organization Members</CardTitle>
            <CardDescription>
              Manage roles and permissions for your team members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                      <span className="font-medium text-gray-600">
                        {(
                          member.firstName?.[0] || member.email[0]
                        ).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {member.firstName && member.lastName
                          ? `${member.firstName} ${member.lastName}`
                          : member.username || member.email}
                        {member.id === currentUser?.id && (
                          <span className="ml-2 text-sm text-gray-500">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {member.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {!member.isActive && (
                      <Badge
                        variant="outline"
                        className="border-red-200 text-red-600"
                      >
                        Inactive
                      </Badge>
                    )}

                    {canManageMember(member) ? (
                      <>
                        <select
                          value={member.organizationRole}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value)
                          }
                          disabled={actionLoading === member.id}
                          className="h-10 w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="MEMBER">Member</option>
                          {currentUser?.role === 'OWNER' && (
                            <option value="ADMIN">Admin</option>
                          )}
                        </select>

                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleRemove(member.id, member.email)}
                          disabled={actionLoading === member.id}
                        >
                          {actionLoading === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Badge
                        className={getRoleBadgeColor(member.organizationRole)}
                      >
                        {member.organizationRole === 'OWNER' && (
                          <Shield className="mr-1 h-3 w-3" />
                        )}
                        {member.organizationRole}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
