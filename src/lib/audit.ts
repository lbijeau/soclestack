import { prisma } from './db';

export type AuditAction =
  // Authentication
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_REMEMBER_ME_CREATED'
  | 'AUTH_REMEMBER_ME_USED'
  | 'AUTH_REMEMBER_ME_REVOKED'
  | 'AUTH_REMEMBER_ME_THEFT_DETECTED'
  // Security
  | 'SECURITY_ACCOUNT_LOCKED'
  | 'SECURITY_ACCOUNT_UNLOCKED'
  | 'SECURITY_PASSWORD_CHANGED'
  | 'SECURITY_ALL_SESSIONS_REVOKED'
  // Two-factor authentication
  | 'AUTH_2FA_ENABLED'
  | 'AUTH_2FA_DISABLED'
  | 'AUTH_2FA_SUCCESS'
  | 'AUTH_2FA_FAILURE'
  | 'AUTH_2FA_BACKUP_USED'
  | 'ADMIN_2FA_RESET';

export type AuditCategory = 'authentication' | 'security' | 'admin';

export interface AuditEvent {
  action: AuditAction;
  category: AuditCategory;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: event.userId,
        action: event.action,
        category: event.category,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    });
  } catch (error) {
    // Log to console but don't throw - audit logging should not break the app
    console.error('Failed to log audit event:', error);
  }
}

export async function getAuditLogs(filters: {
  userId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}): Promise<Array<{
  id: string;
  userId: string | null;
  action: string;
  category: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}>> {
  const logs = await prisma.auditLog.findMany({
    where: {
      userId: filters.userId,
      action: filters.action,
      category: filters.category,
      createdAt: {
        gte: filters.from,
        lte: filters.to,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 100,
    skip: filters.offset || 0,
  });

  return logs.map((log) => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
  }));
}
