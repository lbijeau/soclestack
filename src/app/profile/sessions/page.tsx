import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import {
  getUserActiveSessions,
  REMEMBER_ME_COOKIE_NAME,
} from '@/lib/auth/remember-me';
import { SessionsList } from '@/components/profile/sessions-list';

export default async function SessionsPage() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    redirect('/login');
  }

  const sessions = await getUserActiveSessions(session.userId);

  // Get current session series from cookie to identify "this device"
  const cookieStore = await cookies();
  const rememberMeCookie = cookieStore.get(REMEMBER_ME_COOKIE_NAME);
  let currentSeries: string | undefined;

  if (rememberMeCookie?.value) {
    const parts = rememberMeCookie.value.split(':');
    if (parts.length === 2) {
      currentSeries = parts[0];
    }
  }

  // Convert dates to strings for client component
  const serializedSessions = sessions.map((s) => ({
    ...s,
    lastUsedAt: s.lastUsedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Active Sessions</h1>

      <SessionsList
        sessions={serializedSessions}
        userId={session.userId}
        currentSeries={currentSeries}
      />
    </div>
  );
}
