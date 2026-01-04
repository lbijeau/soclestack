import { getCurrentUser } from '@/lib/auth';
import { RoleEditor } from '@/components/admin/role-editor';
import { redirect } from 'next/navigation';
import { isGranted, ROLES } from '@/lib/security/index';

export const dynamic = 'force-dynamic';

export default async function NewRolePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/admin/roles/new');
  }

  if (!(await isGranted(user, ROLES.ADMIN))) {
    redirect('/admin');
  }

  return (
    <main className="mx-auto max-w-3xl py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <RoleEditor />
      </div>
    </main>
  );
}

export const metadata = {
  title: 'New Role - Admin - SocleStack',
  description: 'Create a new role',
};
