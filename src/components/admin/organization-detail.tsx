'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Building2,
  Users,
  Crown,
  Shield,
  User,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';

interface Member {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  members: Member[];
}

interface OrganizationDetailProps {
  organizationId: string;
}

export function OrganizationDetail({
  organizationId,
}: OrganizationDetailProps) {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  const fetchOrganization = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/admin/organizations/${organizationId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          router.push('/admin/organizations');
          return;
        }
        throw new Error('Failed to fetch organization');
      }

      const data = await response.json();
      setOrganization(data.organization);
    } catch {
      setError('Failed to load organization');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, router]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const handleTransferOwnership = async () => {
    if (!transferTarget) return;

    setIsTransferring(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newOwnerId: transferTarget }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to transfer ownership');
      }

      setSuccess('Ownership transferred successfully');
      setTransferTarget('');
      fetchOrganization();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to transfer ownership'
      );
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    const userId = memberToRemove.userId;
    setRemovingMemberId(userId);
    setMemberToRemove(null);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/members/${userId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to remove member');
      }

      setSuccess('Member removed successfully');
      fetchOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleDeleteOrganization = async () => {
    if (deleteConfirm !== organization?.name) return;

    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to delete organization');
      }

      router.push('/admin/organizations');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete organization'
      );
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  const getMemberName = (member: Member) => {
    if (member.user.firstName && member.user.lastName) {
      return `${member.user.firstName} ${member.user.lastName}`;
    }
    return member.user.username || member.user.email;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'default' as const;
      case 'ADMIN':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        data-testid="organization-detail-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  const currentOwner = organization.members.find((m) => m.role === 'OWNER');
  const nonOwnerMembers = organization.members.filter(
    (m) => m.role !== 'OWNER'
  );

  return (
    <div className="space-y-6" data-testid="organization-detail">
      {/* Back Link */}
      <Button
        variant="ghost"
        onClick={() => router.push('/admin/organizations')}
        data-testid="organization-detail-back-button"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Organizations
      </Button>

      {error && (
        <Alert variant="error" data-testid="organization-detail-error">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" data-testid="organization-detail-success">
          {success}
        </Alert>
      )}

      {/* Organization Info */}
      <Card data-testid="organization-detail-info-card">
        <CardHeader>
          <CardTitle
            className="flex items-center gap-2"
            data-testid="organization-detail-name"
          >
            <Building2 className="h-5 w-5" />
            {organization.name}
          </CardTitle>
          <CardDescription>Organization details and management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Slug</div>
              <div className="text-gray-900">{organization.slug}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Created</div>
              <div className="text-gray-900">
                {formatDate(organization.createdAt)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Members</div>
              <div className="flex items-center text-gray-900">
                <Users className="mr-1 h-4 w-4" />
                {organization.members.length}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Owner</div>
              <div className="text-gray-900">
                {currentOwner ? getMemberName(currentOwner) : 'None'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card data-testid="organization-detail-members-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
          <CardDescription>All members of this organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table
              className="min-w-full divide-y divide-gray-200"
              data-testid="organization-detail-members-table"
            >
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {organization.members.map((member) => (
                  <tr key={member.userId} data-testid="organization-detail-member-row">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">
                          {getMemberName(member)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {formatDate(member.joinedAt)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {member.role !== 'OWNER' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMemberToRemove(member)}
                          disabled={removingMemberId === member.userId}
                          data-testid="organization-detail-remove-member-button"
                        >
                          {removingMemberId === member.userId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Ownership */}
      <Card data-testid="organization-detail-transfer-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Transfer Ownership
          </CardTitle>
          <CardDescription>
            Transfer ownership to another member. The current owner will become
            an admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <select
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2"
              disabled={isTransferring || nonOwnerMembers.length === 0}
              data-testid="organization-detail-transfer-select"
            >
              <option value="">Select new owner...</option>
              {nonOwnerMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {getMemberName(member)} ({member.user.email})
                </option>
              ))}
            </select>
            <Button
              onClick={handleTransferOwnership}
              disabled={!transferTarget || isTransferring}
              data-testid="organization-detail-transfer-button"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                'Transfer Ownership'
              )}
            </Button>
          </div>
          {nonOwnerMembers.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              No other members to transfer ownership to.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200" data-testid="organization-detail-danger-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete this organization. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              To delete this organization, type{' '}
              <strong>{organization.name}</strong> below:
            </p>
            <div className="flex gap-4">
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={`Type "${organization.name}" to confirm`}
                className="flex-1"
                disabled={isDeleting}
                data-testid="organization-detail-delete-confirm-input"
              />
              <Button
                variant="destructive"
                onClick={handleDeleteOrganization}
                disabled={deleteConfirm !== organization.name || isDeleting}
                data-testid="organization-detail-delete-button"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Organization
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          data-testid="organization-detail-remove-modal-overlay"
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            data-testid="organization-detail-remove-modal"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Remove Member
              </h3>
              <button
                onClick={() => setMemberToRemove(null)}
                className="text-gray-400 hover:text-gray-600"
                data-testid="organization-detail-remove-modal-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-6 text-gray-600">
              Are you sure you want to remove{' '}
              <strong>{getMemberName(memberToRemove)}</strong> from the
              organization? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setMemberToRemove(null)}
                data-testid="organization-detail-remove-modal-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveMember}
                data-testid="organization-detail-remove-modal-confirm"
              >
                Remove Member
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
