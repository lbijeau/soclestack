import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getClientIP, isRateLimited } from '@/lib/auth'
import { generateResetToken } from '@/lib/security'
import { sendUnlockEmail } from '@/lib/email'
import { AuthError } from '@/types/auth'
import { z } from 'zod'

export const runtime = 'nodejs'

const requestUnlockSchema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const clientIP = getClientIP(req)

    // Rate limit: 3 requests per hour per IP
    if (isRateLimited(`unlock-request:${clientIP}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message: 'Too many unlock requests. Please try again later.',
          } as AuthError,
        },
        { status: 429 }
      )
    }

    const body = await req.json()
    const validationResult = requestUnlockSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid email address',
          } as AuthError,
        },
        { status: 400 }
      )
    }

    const { email } = validationResult.data

    // Find user - always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        username: true,
        lockedUntil: true,
      },
    })

    // Only send email if user exists and is actually locked
    if (user && user.lockedUntil && user.lockedUntil > new Date()) {
      const unlockToken = await generateResetToken()
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: unlockToken,
          passwordResetExpires: tokenExpiry,
        },
      })

      await sendUnlockEmail(
        user.email,
        unlockToken,
        user.lockedUntil,
        user.firstName || user.username || undefined
      )
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: 'If your account is locked, you will receive an unlock email shortly.',
    })
  } catch (error) {
    console.error('Request unlock error:', error)
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to process unlock request',
        } as AuthError,
      },
      { status: 500 }
    )
  }
}
