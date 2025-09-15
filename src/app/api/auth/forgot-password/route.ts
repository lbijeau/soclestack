import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordResetSchema } from '@/lib/validations'
import { generateResetToken, hashResetToken } from '@/lib/security'
import { prisma } from '@/lib/db'
import { getClientIP, isRateLimited } from '@/lib/auth'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req)
    const rateLimitKey = `forgot-password:${clientIP}`

    if (isRateLimited(rateLimitKey, 3, 60 * 60 * 1000)) { // 3 attempts per hour
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Too many password reset requests. Please try again later.'
          } as AuthError
        },
        { status: 429 }
      )
    }

    const body = await req.json()

    // Validate input
    const validationResult = requestPasswordResetSchema.safeParse(body)
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

    const { email } = validationResult.data

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email }
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      })
    }

    // Generate reset token
    const resetToken = await generateResetToken()
    const hashedToken = await hashResetToken(resetToken)

    // Store reset token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      }
    })

    // TODO: Send password reset email
    // In a real application, you would send an email here
    console.log(`Password reset token for ${email}: ${resetToken}`)

    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.'
    })

  } catch (error) {
    console.error('Forgot password error:', error)
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