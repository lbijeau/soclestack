import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashResetToken, timeSafeEqual } from '@/lib/security'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Verification token is required'
          } as AuthError
        },
        { status: 400 }
      )
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = await hashResetToken(token)

    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpires: {
          gt: new Date()
        }
      }
    })

    if (!user || !user.passwordResetToken) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Invalid or expired verification token'
          } as AuthError
        },
        { status: 401 }
      )
    }

    // Compare tokens in a time-safe manner
    if (!timeSafeEqual(hashedToken, user.passwordResetToken)) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Invalid or expired verification token'
          } as AuthError
        },
        { status: 401 }
      )
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
      }
    })

    return NextResponse.json({
      message: 'Email verified successfully. You can now log in.'
    })

  } catch (error) {
    console.error('Email verification error:', error)
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