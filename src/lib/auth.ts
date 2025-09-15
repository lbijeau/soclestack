import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './db'
import { SessionData } from '@/types/auth'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateSessionToken,
  hashSessionToken
} from './security'
import { User } from '@prisma/client'

// Session configuration
const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'soclestack-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

// Get session from cookies
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}

// Get session from request (for API routes)
export async function getSessionFromRequest(req: NextRequest): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(req, NextResponse.next(), sessionOptions)
}

// Get current user from session
export async function getCurrentUser(): Promise<User | null> {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.userId,
        isActive: true,
      },
    })

    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

// Authenticate user with email and password
export async function authenticateUser(email: string, password: string): Promise<User | null> {
  try {
    const { verifyPassword } = await import('./security')

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.isActive) {
      return null
    }

    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return null
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return user
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

// Create user session
export async function createUserSession(
  user: User,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  accessToken: string
  refreshToken: string
  sessionToken: string
}> {
  // Generate tokens
  const accessToken = await generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  })

  const refreshToken = await generateRefreshToken({
    userId: user.id,
  })

  const sessionToken = await generateSessionToken()
  const sessionTokenHash = await hashSessionToken(sessionToken)

  // Store session in database
  await prisma.userSession.create({
    data: {
      userId: user.id,
      tokenHash: sessionTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress,
      userAgent,
    },
  })

  // Store session data in iron-session
  const session = await getSession()
  session.userId = user.id
  session.email = user.email
  session.role = user.role
  session.isLoggedIn = true
  await session.save()

  return {
    accessToken,
    refreshToken,
    sessionToken,
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
} | null> {
  try {
    const payload = verifyRefreshToken(refreshToken)

    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub,
        isActive: true,
      },
    })

    if (!user) {
      return null
    }

    // Generate new tokens
    const newAccessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    const newRefreshToken = await generateRefreshToken({
      userId: user.id,
    })

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

// Validate access token
export async function validateAccessToken(token: string): Promise<User | null> {
  try {
    const payload = verifyAccessToken(token)

    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub,
        isActive: true,
      },
    })

    return user
  } catch (error) {
    console.error('Token validation error:', error)
    return null
  }
}

// Logout user
export async function logoutUser(sessionToken?: string): Promise<void> {
  try {
    const session = await getSession()

    // Remove session from database if token provided
    if (sessionToken) {
      const sessionTokenHash = await hashSessionToken(sessionToken)
      await prisma.userSession.deleteMany({
        where: {
          tokenHash: sessionTokenHash,
        },
      })
    }

    // Clear iron-session
    session.destroy()
  } catch (error) {
    console.error('Logout error:', error)
  }
}

// Logout from all devices
export async function logoutFromAllDevices(userId: string): Promise<void> {
  try {
    // Remove all user sessions from database
    await prisma.userSession.deleteMany({
      where: { userId },
    })

    // Clear current session
    const session = await getSession()
    session.destroy()
  } catch (error) {
    console.error('Logout from all devices error:', error)
  }
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    await prisma.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })
  } catch (error) {
    console.error('Session cleanup error:', error)
  }
}

// Check if user has required role
export function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    'USER': 1,
    'MODERATOR': 2,
    'ADMIN': 3,
  }

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0

  return userLevel >= requiredLevel
}

// Rate limiting in-memory store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return false
  }

  if (record.count >= limit) {
    return true
  }

  record.count++
  return false
}

// Extract IP address from request
export function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  // NextRequest doesn't have an ip property - extract from headers or connection
  return req.headers.get('cf-connecting-ip') ||
         req.headers.get('x-forwarded-for')?.split(',')[0] ||
         'unknown'
}