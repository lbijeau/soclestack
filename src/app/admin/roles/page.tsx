import { getCurrentUser } from '@/lib/auth';
import { RoleList } from '@/components/admin/role-list';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { redirect } from 'next/navigation';
import { ROLES } from '@/lib/security/index';

export const dynamic = 'force-dynamic';

export default async function AdminRolesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/admin/roles');
  }

  if (user.role !== ROLES.ADMIN) {
    redirect('/admin');
  }

  return (
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Roles</h1>
          <p className="mt-2 text-gray-600">
            Manage platform roles and permissions hierarchy.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Role Hierarchy</CardTitle>
            <CardDescription>
              Roles inherit permissions from their parent. Click a role to view
              details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleList />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Roles - Admin - SocleStack',
  description: 'Admin role management',
};
