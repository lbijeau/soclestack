import { getCurrentUser, hasRequiredRole } from '@/lib/auth'
import { Navbar } from '@/components/navigation/navbar'
import { UserManagement } from '@/components/admin/user-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Shield, Activity, AlertTriangle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login?returnUrl=/admin')
  }

  if (!hasRequiredRole(user.role, 'MODERATOR')) {
    redirect('/dashboard')
  }

  // Get some basic stats
  const [totalUsers, activeUsers, inactiveUsers, adminUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
  ])

  const stats = [
    {
      title: 'Total Users',
      value: totalUsers,
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Active Users',
      value: activeUsers,
      icon: Activity,
      color: 'text-green-600',
    },
    {
      title: 'Inactive Users',
      value: inactiveUsers,
      icon: AlertTriangle,
      color: 'text-red-600',
    },
    {
      title: 'Administrators',
      value: adminUsers,
      icon: Shield,
      color: 'text-purple-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Panel
            </h1>
            <p className="mt-2 text-gray-600">
              Manage users and system settings.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat) => (
              <Card key={stat.title}>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <stat.icon className={`h-8 w-8 ${stat.color}`} />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-500">{stat.title}</div>
                      <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

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
    </div>
  )
}

export const metadata = {
  title: 'Admin Panel - SocleStack',
  description: 'Admin panel for user management',
}