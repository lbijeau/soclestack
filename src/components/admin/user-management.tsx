'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  UserX,
  UserCheck,
  Filter,
  X,
  CheckSquare,
  Loader2,
  Shield,
} from 'lucide-react';
import { UserRoleSelect } from './user-role-select';
import { apiPatch, apiDelete, apiPost } from '@/lib/api-client';
import { hasMinimumRole, displayRole, ROLES } from '@/lib/security/client';

interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface UserManagementProps {
  currentUser: {
    id: string;
    role: string;
  };
}

interface UserListResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    totalUsers: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalUsers: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [roleSelectUser, setRoleSelectUser] = useState<{
    id: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter === 'active') params.set('isActive', 'true');
      if (statusFilter === 'inactive') params.set('isActive', 'false');
      if (statusFilter === 'locked') params.set('locked', 'true');

      const response = await fetch(`/api/users?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data: UserListResponse = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch {
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchUsers();
  };

  const handleClearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    // Fetch will be triggered by the state change
    setTimeout(() => fetchUsers(), 0);
  };

  const hasActiveFilters = search || roleFilter || statusFilter;

  const handleStatusToggle = async (userId: string, isActive: boolean) => {
    if (userId === currentUser.id && !isActive) {
      setError('You cannot deactivate your own account');
      return;
    }

    setTogglingStatusId(userId);
    setError('');

    try {
      const response = await apiPatch(`/api/users/${userId}`, { isActive });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to update status');
      }

      setSuccess(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch {
      setError('Failed to update user status');
    } finally {
      setTogglingStatusId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      setError('You cannot delete your own account');
      return;
    }

    if (
      !confirm(
        'Are you sure you want to delete this user? This action cannot be undone.'
      )
    ) {
      return;
    }

    setDeletingUserId(userId);
    setError('');

    try {
      const response = await apiDelete(`/api/users/${userId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to delete user');
      }

      setSuccess('User deleted successfully');
      fetchUsers();
    } catch {
      setError('Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  // Bulk selection handlers
  const selectableUsers = users.filter(
    (u) => u.id !== currentUser.id && u.role !== ROLES.ADMIN
  );

  const handleSelectAll = () => {
    if (selectedUsers.size === selectableUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(selectableUsers.map((u) => u.id)));
    }
  };

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleBulkAction = async (
    action: 'activate' | 'deactivate' | 'delete'
  ) => {
    if (selectedUsers.size === 0) return;

    const actionLabels = {
      activate: 'activate',
      deactivate: 'deactivate',
      delete: 'permanently delete',
    };

    if (
      !confirm(
        `Are you sure you want to ${actionLabels[action]} ${selectedUsers.size} user(s)?${action === 'delete' ? ' This action cannot be undone.' : ''}`
      )
    ) {
      return;
    }

    setIsBulkActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiPost('/api/admin/users/bulk', {
        userIds: Array.from(selectedUsers),
        action,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to perform bulk action');
      }

      setSuccess(data.message);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to perform bulk action'
      );
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.username) {
      return user.username;
    }
    return user.email;
  };

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {success && <Alert variant="success">{success}</Alert>}

      {/* Search & Filters */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by email, username, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            <Search size={16} className="mr-2" />
            Search
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={16} className="text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="">All roles</option>
            <option value="USER">User</option>
            <option value="MODERATOR">Moderator</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="locked">Locked</option>
          </select>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-gray-500"
            >
              <X size={14} className="mr-1" />
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Bulk Actions Bar */}
      {hasMinimumRole(currentUser.role, ROLES.ADMIN) &&
        selectedUsers.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''}{' '}
                selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('activate')}
                disabled={isBulkActionLoading}
              >
                <UserCheck size={14} className="mr-1" />
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('deactivate')}
                disabled={isBulkActionLoading}
              >
                <UserX size={14} className="mr-1" />
                Deactivate
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkAction('delete')}
                disabled={isBulkActionLoading}
              >
                <Trash2 size={14} className="mr-1" />
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedUsers(new Set())}
                disabled={isBulkActionLoading}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {hasMinimumRole(currentUser.role, ROLES.ADMIN) && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectableUsers.length > 0 &&
                        selectedUsers.size === selectableUsers.length
                      }
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={selectableUsers.length === 0}
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {hasMinimumRole(currentUser.role, ROLES.ADMIN) && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      hasMinimumRole(currentUser.role, ROLES.ADMIN) ? 7 : 6
                    }
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelectable =
                    user.id !== currentUser.id && user.role !== ROLES.ADMIN;
                  return (
                    <tr
                      key={user.id}
                      className={`${user.id === currentUser.id ? 'bg-blue-50' : ''} ${selectedUsers.has(user.id) ? 'bg-blue-50' : ''}`}
                    >
                      {hasMinimumRole(currentUser.role, ROLES.ADMIN) && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          {isSelectable ? (
                            <input
                              type="checkbox"
                              checked={selectedUsers.has(user.id)}
                              onChange={() => handleSelectUser(user.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {getDisplayName(user)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              user.role === ROLES.ADMIN
                                ? 'default'
                                : user.role === ROLES.MODERATOR
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {displayRole(user.role)}
                          </Badge>
                          {hasMinimumRole(currentUser.role, ROLES.ADMIN) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setRoleSelectUser({
                                  id: user.id,
                                  email: user.email,
                                })
                              }
                              title="Manage roles"
                              aria-label={`Manage roles for ${user.email}`}
                            >
                              <Shield size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <Badge
                            variant={user.isActive ? 'default' : 'destructive'}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge
                            variant={
                              user.emailVerified ? 'default' : 'secondary'
                            }
                          >
                            {user.emailVerified ? 'Verified' : 'Unverified'}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                        {user.lastLoginAt
                          ? formatDate(user.lastLoginAt)
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="space-x-2 px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                        {hasMinimumRole(currentUser.role, ROLES.ADMIN) &&
                          user.id !== currentUser.id && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleStatusToggle(user.id, !user.isActive)
                                }
                                disabled={togglingStatusId === user.id}
                              >
                                {togglingStatusId === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : user.isActive ? (
                                  <UserX size={16} />
                                ) : (
                                  <UserCheck size={16} />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={deletingUserId === user.id}
                              >
                                {deletingUserId === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </Button>
                            </>
                          )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button
                variant="ghost"
                disabled={!pagination.hasPrevPage}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                disabled={!pagination.hasNextPage}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page {pagination.page} of {pagination.totalPages} (
                  {pagination.totalUsers} total users)
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
                  <Button
                    variant="ghost"
                    disabled={!pagination.hasPrevPage}
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page - 1,
                      }))
                    }
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500">
                    {pagination.page}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={!pagination.hasNextPage}
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page + 1,
                      }))
                    }
                  >
                    <ChevronRight size={16} />
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Role Selection Modal */}
      {roleSelectUser && (
        <UserRoleSelect
          userId={roleSelectUser.id}
          userEmail={roleSelectUser.email}
          currentUserId={currentUser.id}
          isOpen={!!roleSelectUser}
          onClose={() => setRoleSelectUser(null)}
          onSaved={() => {
            setSuccess('User roles updated successfully');
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}
