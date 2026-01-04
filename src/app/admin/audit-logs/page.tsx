import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuditLogViewer } from '@/components/admin/audit-log-viewer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { isGranted, ROLES } from '@/lib/security/index';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/admin/audit-logs');
  }

  // Only ADMIN can access audit logs (more restrictive than /admin which allows MODERATOR)
  if (!(await isGranted(user, ROLES.ADMIN))) {
    redirect('/dashboard');
  }

  return (
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Admin Panel
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-2 text-gray-600">
            View and export security audit events.
          </p>
        </div>

        {/* Audit Log Viewer */}
        <AuditLogViewer />
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Audit Logs - SocleStack Admin',
  description: 'View security audit logs',
};
