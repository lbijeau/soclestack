import { getCurrentUser, hasRequiredRole } from '@/lib/auth';
import { UserManagement } from '@/components/admin/user-management';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Users,
  Shield,
  Activity,
  AlertTriangle,
  FileText,
  Lock,
  Smartphone,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/admin');
  }

  if (!hasRequiredRole(user.role, 'MODERATOR')) {
    redirect('/dashboard');
  }

  // Get time boundaries
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get comprehensive stats
  const [
    totalUsers,
    activeUsers,
    lockedUsers,
    adminUsers,
    twoFactorEnabled,
    recentLogins,
    failedLogins24h,
    newUsers7d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { lockedUntil: { gt: now } } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { twoFactorEnabled: true } }),
    prisma.auditLog.count({
      where: { action: 'AUTH_LOGIN_SUCCESS', createdAt: { gte: last24h } },
    }),
    prisma.auditLog.count({
      where: { action: 'AUTH_LOGIN_FAILURE', createdAt: { gte: last24h } },
    }),
    prisma.user.count({ where: { createdAt: { gte: last7d } } }),
  ]);

  const twoFactorPercent =
    totalUsers > 0 ? Math.round((twoFactorEnabled / totalUsers) * 100) : 0;

  const userStats = [
    {
      title: 'Total Users',
      value: totalUsers,
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Active',
      value: activeUsers,
      icon: Activity,
      color: 'text-green-600',
    },
    {
      title: 'Locked',
      value: lockedUsers,
      icon: Lock,
      color: lockedUsers > 0 ? 'text-red-600' : 'text-gray-400',
    },
    {
      title: 'Admins',
      value: adminUsers,
      icon: Shield,
      color: 'text-purple-600',
    },
  ];

  const securityStats = [
    {
      title: 'Logins (24h)',
      value: recentLogins,
      icon: LogIn,
      color: 'text-green-600',
    },
    {
      title: 'Failed (24h)',
      value: failedLogins24h,
      icon: AlertTriangle,
      color: failedLogins24h > 10 ? 'text-red-600' : 'text-amber-600',
    },
    {
      title: '2FA Enabled',
      value: `${twoFactorPercent}%`,
      icon: Smartphone,
      color: 'text-blue-600',
    },
    {
      title: 'New (7d)',
      value: newUsers7d,
      icon: UserPlus,
      color: 'text-indigo-600',
    },
  ];

  return (
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="mt-2 text-gray-600">
              Manage users and system settings.
            </p>
          </div>

          {/* User Stats */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-gray-500">Users</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {userStats.map((stat) => (
                <Card key={stat.title}>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                      <div className="ml-3">
                        <div className="text-xs text-gray-500">
                          {stat.title}
                        </div>
                        <div className="text-xl font-bold text-gray-900">
                          {stat.value}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Security Stats */}
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-medium text-gray-500">
              Security & Activity
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {securityStats.map((stat) => (
                <Card key={stat.title}>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                      <div className="ml-3">
                        <div className="text-xs text-gray-500">
                          {stat.title}
                        </div>
                        <div className="text-xl font-bold text-gray-900">
                          {stat.value}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Links - Only for ADMIN */}
          {user.role === 'ADMIN' && (
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Admin Tools
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Link href="/admin/audit-logs">
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <FileText className="h-8 w-8 text-indigo-600" />
                        <div className="ml-4">
                          <div className="font-medium text-gray-900">
                            Audit Logs
                          </div>
                          <div className="text-sm text-gray-500">
                            View security events
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          )}

          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                View and manage all users in the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagement currentUser={user} />
            </CardContent>
          </Card>
        </div>
    </main>
  );
}

export const metadata = {
  title: 'Admin Panel - SocleStack',
  description: 'Admin panel for user management',
};
