import { NextRequest, NextResponse } from 'next/server'
import { refreshAccessToken } from '@/lib/auth'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Refresh token is required'
          } as AuthError
        },
        { status: 400 }
      )
    }

    // Refresh tokens
    const tokens = await refreshAccessToken(refreshToken)

    if (!tokens) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Invalid or expired refresh token'
          } as AuthError
        },
        { status: 401 }
      )
    }

    return NextResponse.json({
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    })

  } catch (error) {
    console.error('Token refresh error:', error)
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