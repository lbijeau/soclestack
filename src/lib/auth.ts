import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from './db';
import { env } from './env';
import { SessionData } from '@/types/auth';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateSessionToken,
  hashSessionToken,
} from './security';
import { User, ApiKeyPermission, Role } from '@prisma/client';
// Note: api-keys is dynamically imported in getAuthContext to avoid
// pulling Node.js crypto into Edge Runtime (middleware)
import { log } from './logger';
import { SECURITY_CONFIG } from './config/security';

// ============================================================================
// Session Configuration
// ============================================================================

/**
 * Shared session configuration used by both Edge Runtime and Node.js.
 * Uses process.env directly for Edge Runtime compatibility.
 * SESSION_SECRET is validated at startup by the env module.
 */
export const SESSION_CONFIG = {
  cookieName: 'soclestack-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
} as const;

// Session duration constants
export const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000; // 7 days in ms
export const SESSION_WARNING_THRESHOLD_MS = 60 * 60 * 1000; // Show warning 1 hour before expiry

/**
 * Iron-session options for Node.js environment.
 * Uses validated env module for SESSION_SECRET.
 */
const sessionOptions = {
  password: env.SESSION_SECRET as string,
  ...SESSION_CONFIG,
};

// Get session from cookies (for Server Components and Route Handlers)
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

// ============================================================================
// Edge Runtime Session Reading
// ============================================================================

/**
 * Iron-session options for Edge Runtime.
 * Uses process.env directly since env module may not be available in Edge.
 * SESSION_SECRET is validated at app startup by the env module.
 */
const edgeSessionOptions = {
  password: process.env.SESSION_SECRET!,
  ...SESSION_CONFIG,
};

// Types for iron-session Edge Runtime compatibility
interface EdgeMockRequest {
  headers: {
    cookie: string;
  };
}

interface EdgeMockResponse {
  getHeader: () => undefined;
  setHeader: () => void;
  headers: Map<string, string>;
}

/**
 * Default empty session for unauthenticated requests.
 * Exported for use by code that needs a default session state.
 */
export const EMPTY_SESSION: SessionData = {
  userId: '',
  email: '',
  role: Role.USER,
  isLoggedIn: false,
};

/**
 * Get session data from a NextRequest (Edge Runtime compatible).
 * This is a read-only operation - use getSession() if you need to modify the session.
 *
 * Note: Returns SessionData (not IronSession) since Edge Runtime only needs
 * read access. For session modification, use getSession() in Node.js context.
 *
 * @param request - The incoming NextRequest
 * @returns SessionData object (read-only, cannot call save/destroy)
 */
export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionData> {
  try {
    const sessionCookie = request.cookies.get(SESSION_CONFIG.cookieName);

    if (!sessionCookie) {
      return EMPTY_SESSION;
    }

    // Create mock request/response for iron-session Edge compatibility
    const mockRequest: EdgeMockRequest = {
      headers: {
        cookie: `${SESSION_CONFIG.cookieName}=${sessionCookie.value}`,
      },
    };

    const mockResponse: EdgeMockResponse = {
      getHeader: () => undefined,
      setHeader: () => {},
      headers: new Map(),
    };

    const session = await getIronSession<SessionData>(
      mockRequest as unknown as Parameters<typeof getIronSession>[0],
      mockResponse as unknown as Parameters<typeof getIronSession>[1],
      edgeSessionOptions
    );

    return session || EMPTY_SESSION;
  } catch (error) {
    console.error('Error reading session from request:', error);
    return EMPTY_SESSION;
  }
}

// Get current user from session
export async function getCurrentUser(): Promise<User | null> {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.userId,
        isActive: true,
      },
    });

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Get session expiry status
export interface SessionStatus {
  isValid: boolean;
  expiresAt: number | null;
  timeRemainingMs: number | null;
  shouldWarn: boolean;
}

export async function getSessionStatus(): Promise<SessionStatus> {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return {
        isValid: false,
        expiresAt: null,
        timeRemainingMs: null,
        shouldWarn: false,
      };
    }

    const createdAt = session.sessionCreatedAt || Date.now();
    const expiresAt = createdAt + SESSION_DURATION_MS;
    const timeRemainingMs = expiresAt - Date.now();
    const shouldWarn =
      timeRemainingMs > 0 && timeRemainingMs <= SESSION_WARNING_THRESHOLD_MS;

    return {
      isValid: timeRemainingMs > 0,
      expiresAt,
      timeRemainingMs: Math.max(0, timeRemainingMs),
      shouldWarn,
    };
  } catch (error) {
    console.error('Error getting session status:', error);
    return {
      isValid: false,
      expiresAt: null,
      timeRemainingMs: null,
      shouldWarn: false,
    };
  }
}

// Extend session by resetting the creation time
export async function extendSession(): Promise<boolean> {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return false;
    }

    session.sessionCreatedAt = Date.now();
    await session.save();
    return true;
  } catch (error) {
    console.error('Error extending session:', error);
    return false;
  }
}

// Authenticate user with email and password
export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  try {
    const { verifyPassword } = await import('./security');

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return null;
    }

    // OAuth-only users cannot log in with password
    if (!user.password) {
      return null;
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return null;
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

// Create user session
export async function createUserSession(
  user: User,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  sessionToken: string;
}> {
  // Generate tokens
  const accessToken = await generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = await generateRefreshToken({
    userId: user.id,
  });

  const sessionToken = await generateSessionToken();
  const sessionTokenHash = await hashSessionToken(sessionToken);

  // Store session in database
  await prisma.userSession.create({
    data: {
      userId: user.id,
      tokenHash: sessionTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress,
      userAgent,
    },
  });

  // Store session data in iron-session
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.role = user.role;
  session.isLoggedIn = true;
  session.sessionCreatedAt = Date.now();
  await session.save();

  return {
    accessToken,
    refreshToken,
    sessionToken,
  };
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const payload = await verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub,
        isActive: true,
      },
    });

    if (!user) {
      return null;
    }

    // Generate new tokens
    const newAccessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const newRefreshToken = await generateRefreshToken({
      userId: user.id,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

// Validate access token
export async function validateAccessToken(token: string): Promise<User | null> {
  try {
    const payload = await verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub,
        isActive: true,
      },
    });

    return user;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

// Logout user
export async function logoutUser(sessionToken?: string): Promise<void> {
  try {
    const session = await getSession();

    // Remove session from database if token provided
    if (sessionToken) {
      const sessionTokenHash = await hashSessionToken(sessionToken);
      await prisma.userSession.deleteMany({
        where: {
          tokenHash: sessionTokenHash,
        },
      });
    }

    // Clear iron-session
    session.destroy();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Logout from all devices
export async function logoutFromAllDevices(userId: string): Promise<void> {
  try {
    // Remove all user sessions from database
    await prisma.userSession.deleteMany({
      where: { userId },
    });

    // Clear current session
    const session = await getSession();
    session.destroy();
  } catch (error) {
    console.error('Logout from all devices error:', error);
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
    });
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}

// Check if user has required role
export function hasRequiredRole(
  userRole: string,
  requiredRole: string
): boolean {
  const roleHierarchy = {
    USER: 1,
    MODERATOR: 2,
    ADMIN: 3,
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel =
    roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

  return userLevel >= requiredLevel;
}

// ============================================================================
// Rate Limiting
// ============================================================================

// In-memory rate limit store (use Redis in production for distributed systems)
export const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

// Cleanup timer management
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the rate limit cleanup timer.
 * Removes expired entries to prevent memory leaks.
 */
export function startRateLimitCleanup(intervalMs?: number): void {
  // Don't start if already running or not in appropriate environment
  if (cleanupIntervalId !== null || typeof setInterval === 'undefined') {
    return;
  }

  const interval = intervalMs ?? SECURITY_CONFIG.rateLimits.cleanupIntervalMs;

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, record] of rateLimitStore) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      log.debug('Rate limit cleanup', {
        cleanedEntries: cleanedCount,
        remainingEntries: rateLimitStore.size,
      });
    }
  }, interval);
}

/**
 * Stop the rate limit cleanup timer.
 * Useful for testing and graceful shutdown.
 */
export function stopRateLimitCleanup(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

// Auto-start cleanup timer (can be stopped for testing)
startRateLimitCleanup();

/**
 * Check if a key is rate limited.
 * @param key - Unique identifier for rate limiting (e.g., "login:192.168.1.1")
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if rate limited, false otherwise
 */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= limit) {
    // Log rate limit exceeded event
    const [action, identifier] = key.split(':');
    log.security.rateLimited(identifier || 'unknown', action || key);
    return true;
  }

  record.count++;
  return false;
}

/**
 * Get current rate limit information for a key.
 * Used for setting X-RateLimit-* headers.
 */
export function getRateLimitInfo(
  key: string,
  limit: number,
  windowMs: number
): { limit: number; remaining: number; reset: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    return {
      limit,
      remaining: limit,
      reset: Math.floor((now + windowMs) / 1000),
    };
  }

  return {
    limit,
    remaining: Math.max(0, limit - record.count),
    reset: Math.floor(record.resetTime / 1000),
  };
}

// Extract IP address from request
export function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  // NextRequest doesn't have an ip property - extract from headers or connection
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown'
  );
}

// API Key authentication context
export interface ApiKeyAuthContext {
  type: 'api_key';
  apiKeyId: string;
  permission: ApiKeyPermission;
  user: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    organizationId: string | null;
  };
}

export interface SessionAuthContext {
  type: 'session';
  user: User;
}

export type AuthContext = ApiKeyAuthContext | SessionAuthContext;

/**
 * Get authentication context from request.
 * Supports both session-based and API key authentication.
 * API key auth is checked first via Authorization header.
 *
 * @note This function is currently NOT used by route handlers.
 * Routes use getCurrentUser() which only supports session auth.
 * To enable API key authentication, routes should be updated to
 * use getAuthContext() instead of getCurrentUser().
 *
 * @see Issue #131 - Verify API key Bearer token middleware implementation
 */
export async function getAuthContext(req: NextRequest): Promise<{
  context: AuthContext | null;
  error?: string;
  status?: number;
}> {
  // Check for API key in Authorization header
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer lsk_')) {
    // Dynamic import to avoid pulling Node.js crypto into Edge Runtime
    const { validateApiKey, isMethodAllowed } = await import('./api-keys');

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    const result = await validateApiKey(apiKey);

    if (!result.valid || !result.apiKey) {
      return {
        context: null,
        error: result.error || 'Invalid API key',
        status: 401,
      };
    }

    // Check if the HTTP method is allowed for this key's permission
    if (!isMethodAllowed(result.apiKey.permission, req.method)) {
      return {
        context: null,
        error: 'This API key does not have permission for this operation',
        status: 403,
      };
    }

    return {
      context: {
        type: 'api_key',
        apiKeyId: result.apiKey.id,
        permission: result.apiKey.permission,
        user: result.apiKey.user,
      },
    };
  }

  // Fall back to session-based authentication
  const user = await getCurrentUser();

  if (!user) {
    return {
      context: null,
      error: 'Not authenticated',
      status: 401,
    };
  }

  return {
    context: {
      type: 'session',
      user,
    },
  };
}

/**
 * Helper to get user from auth context regardless of auth type
 */
export function getUserFromContext(context: AuthContext): {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
} {
  if (context.type === 'session') {
    return {
      id: context.user.id,
      email: context.user.email,
      role: context.user.role,
      organizationId: context.user.organizationId,
    };
  }
  return context.user;
}

/**
 * Result type for requireAuth function
 */
export type RequireAuthResult =
  | {
      success: true;
      context: AuthContext;
      user: ReturnType<typeof getUserFromContext>;
    }
  | { success: false; error: string; status: number };

/**
 * Unified authentication helper for route handlers.
 * Supports both session-based and API key authentication.
 *
 * API keys are validated first if present in Authorization header.
 * Falls back to session-based auth if no API key is provided.
 *
 * @example
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const auth = await requireAuth(req);
 *   if (!auth.success) {
 *     return NextResponse.json({ error: { type: 'AUTHENTICATION_ERROR', message: auth.error } }, { status: auth.status });
 *   }
 *   const { user, context } = auth;
 *   // Use user.id, user.email, user.role, etc.
 *   // Check context.type === 'api_key' for API key specific logic
 * }
 * ```
 */
export async function requireAuth(
  req: NextRequest
): Promise<RequireAuthResult> {
  const result = await getAuthContext(req);

  if (!result.context) {
    return {
      success: false,
      error: result.error || 'Not authenticated',
      status: result.status || 401,
    };
  }

  return {
    success: true,
    context: result.context,
    user: getUserFromContext(result.context),
  };
}
