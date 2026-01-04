import { getCurrentUser } from '@/lib/auth';
import { OrganizationDetail } from '@/components/admin/organization-detail';
import { redirect } from 'next/navigation';
import { ROLES } from '@/lib/security/index';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrganizationDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/admin/organizations');
  }

  if (user.role !== ROLES.ADMIN) {
    redirect('/admin');
  }

  return (
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <OrganizationDetail organizationId={id} />
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Organization Details - Admin - SocleStack',
  description: 'Admin organization detail view',
};
