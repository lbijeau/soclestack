import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginHistory } from '@/components/profile/login-history';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function LoginHistoryPage() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <Link
          href="/profile"
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">Login History</h1>

      <LoginHistory />
    </div>
  );
}
