import { NextResponse } from 'next/server'
import { getSessionStatus } from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/auth/session-status - Get current session expiry status
export async function GET() {
  try {
    const status = await getSessionStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Failed to get session status:', error)
    return NextResponse.json(
      { error: { type: 'INTERNAL_ERROR', message: 'Failed to get session status' } },
      { status: 500 }
    )
  }
}
