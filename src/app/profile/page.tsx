import { getCurrentUser } from '@/lib/auth'
import { Navbar } from '@/components/navigation/navbar'
import { ProfileForm } from '@/components/profile/profile-form'
import { PasswordChangeForm } from '@/components/profile/password-change-form'
import { ExportData } from '@/components/profile/export-data'
import { DeleteAccount } from '@/components/profile/delete-account'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, Monitor, Activity, History, Smartphone } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login?returnUrl=/profile')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
            <p className="mt-2 text-gray-600">
              Manage your account information and security settings.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information and email address.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileForm user={user} />
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordChangeForm />
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle>Security & Privacy</CardTitle>
                <CardDescription>
                  Manage your security settings, sessions, trusted devices, and view activity.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Link
                    href="/profile/security"
                    className="flex items-center gap-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <Shield className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Security Settings</p>
                      <p className="text-sm text-gray-500">2FA, API keys, OAuth</p>
                    </div>
                  </Link>
                  <Link
                    href="/profile/sessions"
                    className="flex items-center gap-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <Monitor className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Active Sessions</p>
                      <p className="text-sm text-gray-500">Manage devices</p>
                    </div>
                  </Link>
                  <Link
                    href="/profile/login-history"
                    className="flex items-center gap-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <History className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium">Login History</p>
                      <p className="text-sm text-gray-500">Recent logins</p>
                    </div>
                  </Link>
                  <Link
                    href="/profile/activity"
                    className="flex items-center gap-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <Activity className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Activity Log</p>
                      <p className="text-sm text-gray-500">Security events</p>
                    </div>
                  </Link>
                  <Link
                    href="/profile/devices"
                    className="flex items-center gap-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <Smartphone className="h-5 w-5 text-teal-600" />
                    <div>
                      <p className="font-medium">Trusted Devices</p>
                      <p className="text-sm text-gray-500">Remember me devices</p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  Read-only information about your account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">User ID</label>
                      <p className="text-sm text-gray-900 font-mono">{user.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Role</label>
                      <p className="text-sm text-gray-900">{user.role}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Account Created</label>
                      <p className="text-sm text-gray-900">
                        {new Intl.DateTimeFormat('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(user.createdAt)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Updated</label>
                      <p className="text-sm text-gray-900">
                        {new Intl.DateTimeFormat('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(user.updatedAt)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email Verified</label>
                      <p className={`text-sm ${user.emailVerified ? 'text-green-600' : 'text-red-600'}`}>
                        {user.emailVerified ? 'Yes' : 'No'}
                        {user.emailVerifiedAt && (
                          <span className="text-gray-500 ml-2">
                            ({new Intl.DateTimeFormat('en-US').format(user.emailVerifiedAt)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Login</label>
                      <p className="text-sm text-gray-900">
                        {user.lastLoginAt
                          ? new Intl.DateTimeFormat('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(user.lastLoginAt)
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Export Data */}
            <ExportData />

            {/* Delete Account */}
            <DeleteAccount
              isAdmin={user.role === 'ADMIN'}
              isOrgOwner={user.organizationRole === 'OWNER'}
              hasPassword={!!user.password}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export const metadata = {
  title: 'Profile - SocleStack',
  description: 'Manage your profile settings',
}