import { IronSession } from 'iron-session';
import { SessionData, ImpersonationData } from '@/types/auth';
import { SECURITY_CONFIG } from '@/lib/config/security';
import { ServiceError } from '@/services/auth.errors';

const { timeoutMinutes } = SECURITY_CONFIG.impersonation;

/**
 * Check if the session is currently impersonating a user
 */
export function isImpersonating(session: IronSession<SessionData>): boolean {
  return !!session.impersonating;
}

/**
 * Check if impersonation has expired (past timeout)
 */
export function hasImpersonationExpired(
  session: IronSession<SessionData>
): boolean {
  if (!session.impersonating) {
    return false;
  }

  const elapsed = Date.now() - session.impersonating.startedAt;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  return elapsed > timeoutMs;
}

/**
 * Get remaining impersonation time in minutes
 */
export function getImpersonationTimeRemaining(
  session: IronSession<SessionData>
): number {
  if (!session.impersonating) {
    return 0;
  }

  const elapsed = Date.now() - session.impersonating.startedAt;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const remainingMs = Math.max(0, timeoutMs - elapsed);

  return Math.ceil(remainingMs / (60 * 1000));
}

/**
 * Get the original admin info if impersonating
 */
export function getOriginalAdmin(
  session: IronSession<SessionData>
): ImpersonationData | null {
  return session.impersonating || null;
}

/**
 * Calculate impersonation duration in seconds
 */
export function getImpersonationDuration(
  session: IronSession<SessionData>
): number {
  if (!session.impersonating) {
    return 0;
  }

  return Math.floor((Date.now() - session.impersonating.startedAt) / 1000);
}

/**
 * Assert that the session is not impersonating (throws if it is)
 */
export function assertNotImpersonating(
  session: IronSession<SessionData>
): void {
  if (isImpersonating(session)) {
    throw new ImpersonationBlockedError();
  }
}

/**
 * Error thrown when an action is blocked during impersonation (403)
 */
export class ImpersonationBlockedError extends ServiceError {
  constructor() {
    super(
      'IMPERSONATION_BLOCKED',
      'This action is not allowed while impersonating a user',
      403
    );
    this.name = 'ImpersonationBlockedError';
  }
}
