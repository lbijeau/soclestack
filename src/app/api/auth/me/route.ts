import { NextResponse } from 'next/server'
import { getCurrentUser, getSession } from '@/lib/auth'
import { isImpersonating, getOriginalAdmin, getImpersonationTimeRemaining } from '@/lib/auth/impersonation'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated'
          } as AuthError
        },
        { status: 401 }
      )
    }

    // Check for impersonation
    const session = await getSession()
    let impersonation = null
    if (isImpersonating(session)) {
      const originalAdmin = getOriginalAdmin(session)
      if (originalAdmin) {
        impersonation = {
          originalEmail: originalAdmin.originalEmail,
          minutesRemaining: getImpersonationTimeRemaining(session),
        }
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      impersonation,
    })

  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred'
        } as AuthError
      },
      { status: 500 }
    )
  }
}