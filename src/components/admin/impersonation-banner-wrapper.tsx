import { getSession } from '@/lib/auth'
import { isImpersonating, getImpersonationTimeRemaining, getOriginalAdmin } from '@/lib/auth/impersonation'
import { ImpersonationBanner } from './impersonation-banner'

export async function ImpersonationBannerWrapper() {
  const session = await getSession()

  if (!session.isLoggedIn || !isImpersonating(session)) {
    return null
  }

  const originalAdmin = getOriginalAdmin(session)
  if (!originalAdmin) {
    return null
  }

  return (
    <ImpersonationBanner
      originalEmail={originalAdmin.originalEmail}
      targetEmail={session.email}
      minutesRemaining={getImpersonationTimeRemaining(session)}
    />
  )
}
