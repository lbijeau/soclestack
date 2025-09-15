'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Search, ChevronLeft, ChevronRight, UserX, UserCheck } from 'lucide-react'

interface User {
  id: string
  email: string
  username?: string
  firstName?: string
  lastName?: string
  role: 'USER' | 'MODERATOR' | 'ADMIN'
  isActive: boolean
  emailVerified: boolean
  lastLoginAt?: string
  createdAt: string
}

interface UserManagementProps {
  currentUser: {
    id: string
    role: string
  }
}

interface UserListResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    totalUsers: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalUsers: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  useEffect(() => {
    fetchUsers()
  }, [pagination.page, search]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
      })

      const response = await fetch(`/api/users?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data: UserListResponse = await response.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } catch {
      setError('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchUsers()
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === currentUser.id) {
      setError('You cannot change your own role')
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to update role')
      }

      setSuccess('User role updated successfully')
      fetchUsers()
    } catch {
      setError('Failed to update user role')
    }
  }

  const handleStatusToggle = async (userId: string, isActive: boolean) => {
    if (userId === currentUser.id && !isActive) {
      setError('You cannot deactivate your own account')
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to update status')
      }

      setSuccess(`User ${isActive ? 'activated' : 'deactivated'} successfully`)
      fetchUsers()
    } catch {
      setError('Failed to update user status')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      setError('You cannot delete your own account')
      return
    }

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to delete user')
      }

      setSuccess('User deleted successfully')
      fetchUsers()
    } catch {
      setError('Failed to delete user')
    }
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString))
  }

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`
    }
    if (user.username) {
      return user.username
    }
    return user.email
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          {success}
        </Alert>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search users by email, username, or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          <Search size={16} className="mr-2" />
          Search
        </Button>
      </form>

      {/* Users Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className={user.id === currentUser.id ? 'bg-blue-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getDisplayName(user)}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {currentUser.role === 'ADMIN' && user.id !== currentUser.id ? (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as 'USER' | 'MODERATOR' | 'ADMIN')}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="USER">User</option>
                          <option value="MODERATOR">Moderator</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      ) : (
                        <Badge variant={user.role === 'ADMIN' ? 'default' : user.role === 'MODERATOR' ? 'secondary' : 'outline'}>
                          {user.role}
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <Badge variant={user.isActive ? 'default' : 'destructive'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                          {user.emailVerified ? 'Verified' : 'Unverified'}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {currentUser.role === 'ADMIN' && user.id !== currentUser.id && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStatusToggle(user.id, !user.isActive)}
                          >
                            {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                variant="ghost"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                disabled={!pagination.hasNextPage}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalUsers} total users)
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <Button
                    variant="ghost"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500">
                    {pagination.page}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}