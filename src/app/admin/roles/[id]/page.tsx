import { getCurrentUser } from '@/lib/auth';
import { RoleEditor } from '@/components/admin/role-editor';
import { redirect } from 'next/navigation';
import { isGranted, ROLES } from '@/lib/security/index';

export const dynamic = 'force-dynamic';

interface EditRolePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRolePage({ params }: EditRolePageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?returnUrl=/admin/roles/${id}`);
  }

  if (!(await isGranted(user, ROLES.ADMIN))) {
    redirect('/admin');
  }

  return (
    <main className="mx-auto max-w-3xl py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <RoleEditor roleId={id} />
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: EditRolePageProps) {
  const { id } = await params;
  return {
    title: `Edit Role - Admin - SocleStack`,
    description: `Edit role ${id}`,
  };
}
