import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { ActivityLog } from '@/components/profile/activity-log'

export default async function ActivityPage() {
  const session = await getSession()

  if (!session.isLoggedIn || !session.userId) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Activity Log</h1>
      <ActivityLog />
    </div>
  )
}
