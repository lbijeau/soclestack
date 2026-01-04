import { getCurrentUser } from '@/lib/auth';
import { checkPasswordAge } from '@/lib/auth/password-age';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { User, Calendar, Shield, Activity, AlertTriangle } from 'lucide-react';
import { EmailVerificationBanner } from '@/components/auth/email-verification-banner';
import { SecurityEventsWidget } from '@/components/dashboard/security-events-widget';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { error } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/dashboard');
  }

  // Check password age (only for users with passwords, not OAuth-only)
  const passwordStatus = user.password
    ? checkPasswordAge(user.passwordChangedAt)
    : null;

  const getWelcomeMessage = () => {
    const name = user.firstName || user.username || 'there';
    return `Welcome back, ${name}!`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Authorization Error Alert */}
        {error === 'unauthorized' && (
          <Alert variant="error" className="mb-6">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Access Denied</p>
                <p className="mt-1 text-sm">
                  You don&apos;t have permission to access that page.
                </p>
              </div>
            </div>
          </Alert>
        )}

        {/* Email Verification Banner */}
        {!user.emailVerified && <EmailVerificationBanner email={user.email} />}

        {/* Password Expiration Warning */}
        {passwordStatus?.isExpired && (
          <Alert variant="error" className="mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Your password has expired</p>
                <p className="mt-1 text-sm">
                  Your password is {passwordStatus.daysSinceChange} days old.
                  Please change it immediately for security.
                </p>
                <Link
                  href="/profile"
                  className="mt-2 inline-block text-sm underline"
                >
                  Change password now
                </Link>
              </div>
            </div>
          </Alert>
        )}

        {passwordStatus?.isWarning && !passwordStatus.isExpired && (
          <Alert variant="warning" className="mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Password expiring soon</p>
                <p className="mt-1 text-sm">
                  Your password will expire in {passwordStatus.daysUntilExpiry}{' '}
                  days. Consider changing it soon.
                </p>
                <Link
                  href="/profile"
                  className="mt-2 inline-block text-sm underline"
                >
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
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="h-32">
            <CardContent className="flex h-full items-center justify-center p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500">Role</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {user.role}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-32">
            <CardContent className="flex h-full items-center justify-center p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500">
                    Member Since
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatDate(user.createdAt).split(',')[0]}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-32">
            <CardContent className="flex h-full items-center justify-center p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Shield className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500">
                    Status
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {user.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-32">
            <CardContent className="flex h-full items-center justify-center p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500">
                    Last Login
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {user.lastLoginAt
                      ? formatDate(user.lastLoginAt).split(',')[0]
                      : 'Never'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Hello World Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Hello World!</CardTitle>
              <CardDescription>
                Welcome to your SocleStack dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center">
                <div className="mb-4 text-6xl">👋</div>
                <h3 className="mb-2 text-2xl font-bold text-gray-900">
                  Hello World!
                </h3>
                <p className="mb-6 text-gray-600">
                  You&apos;ve successfully logged into your SocleStack account.
                  This is a complete Next.js application with Enterprise-grade
                  user management features.
                </p>
                <div className="space-y-3">
                  <Link
                    href="/profile"
                    className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Manage Profile
                  </Link>
                  {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                    <Link
                      href="/admin"
                      className="inline-flex w-full items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      Admin Panel
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Events Widget */}
          <SecurityEventsWidget />
        </div>

        {/* Account Info Section */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your account details and verification status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b py-2">
                  <span className="text-sm font-medium text-gray-500">
                    Email
                  </span>
                  <span className="text-sm text-gray-900">{user.email}</span>
                </div>

                {user.username && (
                  <div className="flex items-center justify-between border-b py-2">
                    <span className="text-sm font-medium text-gray-500">
                      Username
                    </span>
                    <span className="text-sm text-gray-900">
                      {user.username}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-b py-2">
                  <span className="text-sm font-medium text-gray-500">
                    Email Verified
                  </span>
                  <span
                    className={`text-sm ${user.emailVerified ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {user.emailVerified ? 'Yes' : 'No'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b py-2">
                  <span className="text-sm font-medium text-gray-500">
                    Account Status
                  </span>
                  <span
                    className={`text-sm ${user.isActive ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-gray-500">
                    Role
                  </span>
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    {user.role}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Dashboard - SocleStack',
  description: 'Your SocleStack dashboard',
};
