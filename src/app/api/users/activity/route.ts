import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

// Security events users should see in their activity log
const USER_VISIBLE_ACTIONS = [
  // Authentication
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILURE',
  'AUTH_LOGOUT',
  'AUTH_REMEMBER_ME_CREATED',
  'AUTH_REMEMBER_ME_USED',
  'AUTH_REMEMBER_ME_THEFT_DETECTED',
  // Security
  'SECURITY_ACCOUNT_LOCKED',
  'SECURITY_ACCOUNT_UNLOCKED',
  'SECURITY_PASSWORD_CHANGED',
  'SECURITY_ALL_SESSIONS_REVOKED',
  // Two-factor authentication
  'AUTH_2FA_ENABLED',
  'AUTH_2FA_DISABLED',
  'AUTH_2FA_SUCCESS',
  'AUTH_2FA_FAILURE',
  'AUTH_2FA_BACKUP_USED',
  'ADMIN_2FA_RESET',
  // OAuth
  'AUTH_OAUTH_LOGIN_SUCCESS',
  'AUTH_OAUTH_LOGIN_FAILURE',
  'AUTH_OAUTH_REGISTRATION',
  'AUTH_OAUTH_ACCOUNT_LINKED',
  'AUTH_OAUTH_ACCOUNT_UNLINKED',
  // API Keys
  'API_KEY_CREATED',
  'API_KEY_UPDATED',
  'API_KEY_REVOKED',
]

// GET /api/users/activity - Get current user's activity log
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    // Fetch activity logs for this user
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          userId: currentUser.id,
          action: { in: USER_VISIBLE_ACTIONS },
        },
        select: {
          id: true,
          action: true,
          category: true,
          ipAddress: true,
          userAgent: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({
        where: {
          userId: currentUser.id,
          action: { in: USER_VISIBLE_ACTIONS },
        },
      }),
    ])

    // Parse metadata JSON
    const formattedLogs = logs.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }))

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get activity log error:', error)
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    )
  }
}
