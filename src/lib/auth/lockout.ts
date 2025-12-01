import { prisma } from '../db';
import { logAuditEvent } from '../audit';
import { SECURITY_CONFIG } from '../config/security';
import { sendAccountLockedNotification } from '../email';

const { maxFailedAttempts, durationMinutes } = SECURITY_CONFIG.lockout;

export interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: Date | null;
  remainingAttempts: number;
}

export async function checkAccountLocked(userId: string): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true, failedLoginAttempts: true },
  });

  if (!user) {
    return { isLocked: false, lockedUntil: null, remainingAttempts: maxFailedAttempts };
  }

  const now = new Date();

  // Check if lockout has expired
  if (user.lockedUntil && user.lockedUntil > now) {
    return {
      isLocked: true,
      lockedUntil: user.lockedUntil,
      remainingAttempts: 0,
    };
  }

  // Lockout expired, clear it
  if (user.lockedUntil && user.lockedUntil <= now) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
    return { isLocked: false, lockedUntil: null, remainingAttempts: maxFailedAttempts };
  }

  return {
    isLocked: false,
    lockedUntil: null,
    remainingAttempts: maxFailedAttempts - user.failedLoginAttempts,
  };
}

export async function recordFailedAttempt(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, email: true },
  });

  if (!user) {
    return { isLocked: false, lockedUntil: null, remainingAttempts: maxFailedAttempts };
  }

  const newAttempts = user.failedLoginAttempts + 1;
  const shouldLock = newAttempts >= maxFailedAttempts;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + durationMinutes * 60 * 1000)
    : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newAttempts,
      lockedUntil,
    },
  });

  // Log the lockout event and send notification if account was just locked
  if (shouldLock && lockedUntil) {
    await logAuditEvent({
      action: 'SECURITY_ACCOUNT_LOCKED',
      category: 'security',
      userId,
      ipAddress,
      userAgent,
      metadata: { reason: 'too_many_failed_attempts', attempts: newAttempts },
    });

    // Send email notification (fire-and-forget)
    sendAccountLockedNotification(user.email, lockedUntil).catch((err) =>
      console.error('Failed to send account locked notification:', err)
    );
  }

  return {
    isLocked: shouldLock,
    lockedUntil,
    remainingAttempts: shouldLock ? 0 : maxFailedAttempts - newAttempts,
  };
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

export async function unlockAccount(
  userId: string,
  adminId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await logAuditEvent({
    action: 'SECURITY_ACCOUNT_UNLOCKED',
    category: 'admin',
    userId,
    ipAddress,
    userAgent,
    metadata: { unlockedBy: adminId },
  });
}
