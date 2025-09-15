import { NextRequest, NextResponse } from 'next/server'
import { resetPasswordSchema } from '@/lib/validations'
import { hashPassword, hashResetToken, timeSafeEqual } from '@/lib/security'
import { prisma } from '@/lib/db'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate input
    const validationResult = resetPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: validationResult.error.flatten().fieldErrors
          } as AuthError
        },
        { status: 400 }
      )
    }

    const { token, password } = validationResult.data

    // Hash the provided token to compare with stored hash
    const hashedToken = await hashResetToken(token)

    // Find user with this reset token
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
            message: 'Invalid or expired reset token'
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
            message: 'Invalid or expired reset token'
          } as AuthError
        },
        { status: 401 }
      )
    }

    // Hash new password
    const hashedPassword = await hashPassword(password)

    // Store old password in history
    await prisma.passwordHistory.create({
      data: {
        userId: user.id,
        password: user.password,
      }
    })

    // Update user's password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      }
    })

    // Logout from all devices for security
    await prisma.userSession.deleteMany({
      where: { userId: user.id }
    })

    return NextResponse.json({
      message: 'Password reset successfully. Please log in with your new password.'
    })

  } catch (error) {
    console.error('Reset password error:', error)
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