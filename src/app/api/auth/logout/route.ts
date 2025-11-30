import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logoutUser, getSession, getClientIP } from '@/lib/auth'
import { revokeRememberMeToken, REMEMBER_ME_COOKIE_NAME } from '@/lib/auth/remember-me'
import { logAuditEvent } from '@/lib/audit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const clientIP = getClientIP(req)
    const userAgent = req.headers.get('user-agent') || undefined

    // Get current session to log the event
    const session = await getSession()
    const userId = session.userId

    // Get session token from headers if provided
    const authHeader = req.headers.get('authorization')
    const sessionToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined

    // Revoke remember-me token if exists
    const cookieStore = await cookies()
    const rememberMeCookie = cookieStore.get(REMEMBER_ME_COOKIE_NAME)

    if (rememberMeCookie?.value) {
      const series = rememberMeCookie.value.split(':')[0]
      if (series) {
        await revokeRememberMeToken(series, userId, clientIP, userAgent)
      }

      // Clear the cookie
      cookieStore.delete(REMEMBER_ME_COOKIE_NAME)
    }

    // Log the logout event
    if (userId) {
      await logAuditEvent({
        action: 'AUTH_LOGOUT',
        category: 'authentication',
        userId,
        ipAddress: clientIP,
        userAgent,
      })
    }

    // Logout user
    await logoutUser(sessionToken)

    return NextResponse.json({
      message: 'Logout successful'
    })

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred'
        }
      },
      { status: 500 }
    )
  }
}