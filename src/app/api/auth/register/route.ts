import { NextRequest, NextResponse } from 'next/server'
import { registerSchema } from '@/lib/validations'
import { hashPassword, generateResetToken } from '@/lib/security'
import { prisma } from '@/lib/db'
import { getClientIP, isRateLimited } from '@/lib/auth'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req)
    const rateLimitKey = `register:${clientIP}`

    if (isRateLimited(rateLimitKey, 3, 60 * 60 * 1000)) { // 3 attempts per hour
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Too many registration attempts. Please try again later.'
          } as AuthError
        },
        { status: 429 }
      )
    }

    const body = await req.json()

    // Validate input
    const validationResult = registerSchema.safeParse(body)
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

    const { email, username, password, firstName, lastName } = validationResult.data

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : [])
        ]
      }
    })

    if (existingUser) {
      const conflictField = existingUser.email === email ? 'email' : 'username'
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: `A user with this ${conflictField} already exists`,
            details: {
              [conflictField]: [`This ${conflictField} is already taken`]
            }
          } as AuthError
        },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Generate email verification token
    const emailVerificationToken = await generateResetToken()

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        passwordResetToken: emailVerificationToken,
        passwordResetExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      }
    })

    // TODO: Send email verification email
    // In a real application, you would send an email here
    console.log(`Email verification token for ${email}: ${emailVerificationToken}`)

    // Return success response (without sensitive data)
    return NextResponse.json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Registration error:', error)
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