import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { EmailLogViewer } from '@/components/admin/email-log-viewer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { isGranted, ROLES } from '@/lib/security/index';

export const dynamic = 'force-dynamic';

export default async function AdminEmailsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/admin/emails');
  }

  // Only ADMIN can access email logs
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
          <h1 className="text-3xl font-bold text-gray-900">Email Logs</h1>
          <p className="mt-2 text-gray-600">
            View sent emails, check delivery status, and resend failed messages.
          </p>
        </div>

        {/* Email Log Viewer */}
        <EmailLogViewer />
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Email Logs - SocleStack Admin',
  description: 'View and manage email delivery logs',
};
