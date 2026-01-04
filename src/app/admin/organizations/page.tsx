import { getCurrentUser } from '@/lib/auth';
import { OrganizationList } from '@/components/admin/organization-list';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { redirect } from 'next/navigation';
import { isGranted, ROLES } from '@/lib/security/index';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/admin/organizations');
  }

  if (!(await isGranted(user, ROLES.ADMIN))) {
    redirect('/admin');
  }

  return (
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="mt-2 text-gray-600">
            View and manage all organizations in the system.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Organizations</CardTitle>
            <CardDescription>
              Click on an organization to view details and manage members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationList />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Organizations - Admin - SocleStack',
  description: 'Admin organization management',
};
