import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SecuritySettings } from '@/components/profile/security-settings'
import { OAuthAccounts } from '@/components/profile/oauth-accounts'
import { ApiKeys } from '@/components/profile/api-keys'
import { Loader2 } from 'lucide-react'

export default async function SecurityPage() {
  const session = await getSession()

  if (!session.isLoggedIn || !session.userId) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      role: true,
      twoFactorEnabled: true,
      _count: {
        select: {
          backupCodes: {
            where: { usedAt: null },
          },
        },
      },
    },
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Security Settings</h1>

      <SecuritySettings
        twoFactorEnabled={user.twoFactorEnabled}
        isAdmin={user.role === 'ADMIN'}
        remainingBackupCodes={user._count.backupCodes}
      />

      <Suspense fallback={
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      }>
        <OAuthAccounts />
      </Suspense>

      <ApiKeys />
    </div>
  )
}
