import { prisma } from '@/lib/db';
import { SECURITY_CONFIG } from '@/lib/config/security';

export interface CleanupResult {
  hardDeleted: number;
  bodiesPurged: number;
  errors: string[];
  dryRun: boolean;
}

const PURGED_MARKER = '[PURGED]';

/**
 * Clean up email logs according to retention policy.
 *
 * 1. Hard-delete soft-deleted records older than softDeleteRetentionDays
 * 2. Purge htmlBody from records older than htmlBodyRetentionDays
 *
 * This helps with:
 * - GDPR compliance (data minimization)
 * - Security (tokens in htmlBody don't persist indefinitely)
 * - Storage optimization
 *
 * @param dryRun - If true, only count records without modifying them
 */
export async function cleanupEmailLogs(
  dryRun: boolean = false
): Promise<CleanupResult> {
  const { softDeleteRetentionDays, htmlBodyRetentionDays, batchSize } =
    SECURITY_CONFIG.emailRetention;

  const now = new Date();
  const softDeleteCutoff = new Date(
    now.getTime() - softDeleteRetentionDays * 24 * 60 * 60 * 1000
  );
  const htmlBodyCutoff = new Date(
    now.getTime() - htmlBodyRetentionDays * 24 * 60 * 60 * 1000
  );

  const result: CleanupResult = {
    hardDeleted: 0,
    bodiesPurged: 0,
    errors: [],
    dryRun,
  };

  // 1. Hard-delete soft-deleted records past retention period
  try {
    const whereClause = {
      deletedAt: {
        not: null,
        lt: softDeleteCutoff,
      },
    };

    if (dryRun) {
      result.hardDeleted = await prisma.emailLog.count({ where: whereClause });
    } else {
      const deleteResult = await prisma.emailLog.deleteMany({
        where: whereClause,
      });
      result.hardDeleted = deleteResult.count;
    }
  } catch (error) {
    result.errors.push(
      `Failed to hard-delete records: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 2. Purge htmlBody from old records (keep metadata)
  // Process in batches to avoid memory issues
  try {
    const whereClause = {
      createdAt: { lt: htmlBodyCutoff },
      htmlBody: { not: PURGED_MARKER, notIn: [''] },
      deletedAt: null, // Only process non-deleted records
    };

    if (dryRun) {
      result.bodiesPurged = await prisma.emailLog.count({ where: whereClause });
    } else {
      let purgedCount = 0;
      let hasMore = true;

      while (hasMore) {
        const oldRecords = await prisma.emailLog.findMany({
          where: whereClause,
          select: { id: true },
          take: batchSize,
        });

        if (oldRecords.length === 0) {
          hasMore = false;
          break;
        }

        const updateResult = await prisma.emailLog.updateMany({
          where: {
            id: { in: oldRecords.map((r) => r.id) },
          },
          data: {
            htmlBody: PURGED_MARKER,
          },
        });

        purgedCount += updateResult.count;

        // If we got fewer than batchSize, we're done
        if (oldRecords.length < batchSize) {
          hasMore = false;
        }
      }

      result.bodiesPurged = purgedCount;
    }
  } catch (error) {
    result.errors.push(
      `Failed to purge htmlBody: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Get statistics about email logs for monitoring.
 */
export async function getEmailLogStats(): Promise<{
  total: number;
  softDeleted: number;
  pendingHardDelete: number;
  pendingBodyPurge: number;
}> {
  const { softDeleteRetentionDays, htmlBodyRetentionDays } =
    SECURITY_CONFIG.emailRetention;

  const now = new Date();
  const softDeleteCutoff = new Date(
    now.getTime() - softDeleteRetentionDays * 24 * 60 * 60 * 1000
  );
  const htmlBodyCutoff = new Date(
    now.getTime() - htmlBodyRetentionDays * 24 * 60 * 60 * 1000
  );

  const [total, softDeleted, pendingHardDelete, pendingBodyPurge] =
    await Promise.all([
      prisma.emailLog.count(),
      prisma.emailLog.count({ where: { deletedAt: { not: null } } }),
      prisma.emailLog.count({
        where: {
          deletedAt: { not: null, lt: softDeleteCutoff },
        },
      }),
      prisma.emailLog.count({
        where: {
          createdAt: { lt: htmlBodyCutoff },
          htmlBody: { not: PURGED_MARKER, notIn: [''] },
          deletedAt: null,
        },
      }),
    ]);

  return {
    total,
    softDeleted,
    pendingHardDelete,
    pendingBodyPurge,
  };
}
