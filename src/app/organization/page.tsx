'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navigation/navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Building2, Users, Mail, Settings, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  slug: string
  memberCount: number
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  createdAt: string
}

export default function OrganizationPage() {
  const router = useRouter()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchOrganization()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchOrganization = async () => {
    try {
      const res = await fetch('/api/organizations/current')
      if (res.status === 404) {
        router.push('/dashboard')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch organization')
      const data = await res.json()
      setOrganization(data.organization)
      setName(data.organization.name)
    } catch {
      setError('Failed to load organization')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/organizations/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed to update organization')
      }

      const data = await res.json()
      setOrganization(prev => prev ? { ...prev, name: data.organization.name } : null)
      setSuccess('Organization updated successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this organization? This action cannot be undone. All members will be removed from the organization.')) {
      return
    }

    setDeleting(true)
    setError('')

    try {
      const res = await fetch('/api/organizations/current', {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed to delete organization')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization')
      setDeleting(false)
    }
  }

  const canEdit = organization?.role === 'OWNER' || organization?.role === 'ADMIN'
  const canDelete = organization?.role === 'OWNER'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-4xl mx-auto py-6 px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </main>
      </div>
    )
  }

  if (!organization) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto py-6 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your organization settings and members.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/organization/members">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <div className="font-medium text-gray-900">Members</div>
                    <div className="text-sm text-gray-500">{organization.memberCount} members</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {canEdit && (
            <Link href="/organization/invites">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Mail className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <div className="font-medium text-gray-900">Invitations</div>
                      <div className="text-sm text-gray-500">Manage invites</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          <Card className="h-full">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <div className="font-medium text-gray-900">Your Role</div>
                  <div className="text-sm text-gray-500">{organization.role}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organization Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Organization Details
            </CardTitle>
            <CardDescription>
              Basic information about your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Organization Name
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit || saving}
                  className="mt-1"
                />
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                  URL Slug
                </label>
                <Input
                  id="slug"
                  value={organization.slug}
                  disabled
                  className="mt-1 bg-gray-50"
                />
                <p className="mt-1 text-sm text-gray-500">
                  The URL slug cannot be changed.
                </p>
              </div>

              <div>
                <label htmlFor="created" className="block text-sm font-medium text-gray-700">
                  Created
                </label>
                <Input
                  id="created"
                  value={new Date(organization.createdAt).toLocaleDateString()}
                  disabled
                  className="mt-1 bg-gray-50"
                />
              </div>

              {canEdit && (
                <div className="pt-4">
                  <Button type="submit" disabled={saving || name === organization.name}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        {canDelete && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions that affect the entire organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Delete Organization</p>
                  <p className="text-sm text-gray-500">
                    Permanently delete this organization and remove all members.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Organization'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
