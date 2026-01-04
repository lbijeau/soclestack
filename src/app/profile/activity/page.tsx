import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ActivityLog } from '@/components/profile/activity-log';

export default async function ActivityPage() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Activity Log</h1>
      <ActivityLog />
    </div>
  );
}
