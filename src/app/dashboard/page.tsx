import { getCurrentUser } from '@/lib/auth'
import { checkPasswordAge } from '@/lib/auth/password-age'
import { Navbar } from '@/components/navigation/navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { User, Calendar, Shield, Activity, AlertTriangle } from 'lucide-react'
import { EmailVerificationBanner } from '@/components/auth/email-verification-banner'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login?returnUrl=/dashboard')
  }

  // Check password age (only for users with passwords, not OAuth-only)
  const passwordStatus = user.password ? checkPasswordAge(user.passwordChangedAt) : null

  const getWelcomeMessage = () => {
    const name = user.firstName || user.username || 'there'
    return `Welcome back, ${name}!`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Email Verification Banner */}
          {!user.emailVerified && (
            <EmailVerificationBanner email={user.email} />
          )}

          {/* Password Expiration Warning */}
          {passwordStatus?.isExpired && (
            <Alert variant="error" className="mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Your password has expired</p>
                  <p className="text-sm mt-1">
                    Your password is {passwordStatus.daysSinceChange} days old. Please change it immediately for security.
                  </p>
                  <Link href="/profile" className="text-sm underline mt-2 inline-block">
                    Change password now
                  </Link>
                </div>
              </div>
            </Alert>
          )}

          {passwordStatus?.isWarning && !passwordStatus.isExpired && (
            <Alert variant="warning" className="mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Password expiring soon</p>
                  <p className="text-sm mt-1">
                    Your password will expire in {passwordStatus.daysUntilExpiry} days. Consider changing it soon.
                  </p>
                  <Link href="/profile" className="text-sm underline mt-2 inline-block">
                    Change password
                  </Link>
                </div>
              </div>
            </Alert>
          )}

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {getWelcomeMessage()}
            </h1>
            <p className="mt-2 text-gray-600">
              Here&apos;s what&apos;s happening with your account today.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="h-32">
              <CardContent className="flex items-center justify-center h-full p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <User className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Role</div>
                    <div className="text-2xl font-bold text-gray-900">{user.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="h-32">
              <CardContent className="flex items-center justify-center h-full p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Calendar className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Member Since</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatDate(user.createdAt).split(',')[0]}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="h-32">
              <CardContent className="flex items-center justify-center h-full p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Shield className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Status</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {user.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="h-32">
              <CardContent className="flex items-center justify-center h-full p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Activity className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Last Login</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt).split(',')[0] : 'Never'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Hello World Card */}
            <Card>
              <CardHeader>
                <CardTitle>Hello World!</CardTitle>
                <CardDescription>
                  Welcome to your SocleStack dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">👋</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Hello World!
                  </h3>
                  <p className="text-gray-600 mb-6">
                    You&apos;ve successfully logged into your SocleStack account.
                    This is a complete Next.js application with Enterprise-grade-style user management features.
                  </p>
                  <div className="space-y-3">
                    <Link href="/profile">
                      <Button className="w-full">
                        Manage Profile
                      </Button>
                    </Link>
                    {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                      <Link href="/admin">
                        <Button variant="secondary" className="w-full">
                          Admin Panel
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  Your account details and verification status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium text-gray-500">Email</span>
                    <span className="text-sm text-gray-900">{user.email}</span>
                  </div>

                  {user.username && (
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm font-medium text-gray-500">Username</span>
                      <span className="text-sm text-gray-900">{user.username}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium text-gray-500">Email Verified</span>
                    <span className={`text-sm ${user.emailVerified ? 'text-green-600' : 'text-red-600'}`}>
                      {user.emailVerified ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium text-gray-500">Account Status</span>
                    <span className={`text-sm ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-medium text-gray-500">Role</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

export const metadata = {
  title: 'Dashboard - SocleStack',
  description: 'Your SocleStack dashboard',
}