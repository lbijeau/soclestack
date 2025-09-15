import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validations'
import { authenticateUser, createUserSession, getClientIP, isRateLimited } from '@/lib/auth'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req)
    const rateLimitKey = `login:${clientIP}`

    if (isRateLimited(rateLimitKey, 5, 15 * 60 * 1000)) { // 5 attempts per 15 minutes
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Too many login attempts. Please try again later.'
          } as AuthError
        },
        { status: 429 }
      )
    }

    const body = await req.json()

    // Validate input
    const validationResult = loginSchema.safeParse(body)
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

    const { email, password } = validationResult.data

    // Authenticate user
    const user = await authenticateUser(email, password)
    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Invalid email or password'
          } as AuthError
        },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Please verify your email before logging in'
          } as AuthError
        },
        { status: 403 }
      )
    }

    // Create session
    const userAgent = req.headers.get('user-agent') || undefined
    const tokens = await createUserSession(user, clientIP, userAgent)

    // Return success response
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    })

  } catch (error) {
    console.error('Login error:', error)
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