import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { parseUserAgent } from '@/lib/utils/user-agent'

export const runtime = 'nodejs'

// GET /api/users/devices - Get user's trusted devices
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { type: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Get remember me tokens (trusted devices)
    const rememberMeTokens = await prisma.rememberMeToken.findMany({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        series: true,
        ipAddress: true,
        userAgent: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
    })

    // Get current device identifier from cookies
    const currentSeries = request.cookies.get('remember_series')?.value

    // Parse user agents and mark current device
    const devices = rememberMeTokens.map((token) => {
      const deviceInfo = token.userAgent ? parseUserAgent(token.userAgent) : null
      return {
        id: token.id,
        series: token.series,
        browser: deviceInfo?.browser || 'Unknown Browser',
        os: deviceInfo?.os || 'Unknown OS',
        ipAddress: token.ipAddress || 'Unknown',
        lastUsedAt: token.lastUsedAt,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        isCurrent: token.series === currentSeries,
      }
    })

    return NextResponse.json({ devices })
  } catch (error) {
    console.error('Failed to fetch devices:', error)
    return NextResponse.json(
      { error: { type: 'INTERNAL_ERROR', message: 'Failed to fetch devices' } },
      { status: 500 }
    )
  }
}
