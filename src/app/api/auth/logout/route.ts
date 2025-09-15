import { NextRequest, NextResponse } from 'next/server'
import { logoutUser } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Get session token from headers if provided
    const authHeader = req.headers.get('authorization')
    const sessionToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined

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