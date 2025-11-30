import { getSession } from '@/lib/auth'
import { isImpersonating, getImpersonationTimeRemaining } from '@/lib/auth/impersonation'
import { ImpersonationBanner } from './impersonation-banner'

export async function ImpersonationBannerWrapper() {
  const session = await getSession()

  if (!session.isLoggedIn || !isImpersonating(session)) {
    return null
  }

  return (
    <ImpersonationBanner
      targetEmail={session.email}
      timeRemainingMinutes={getImpersonationTimeRemaining(session)}
    />
  )
}
