import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth-edge'
import { securityHeaders, contentSecurityPolicy } from '@/lib/security-headers'

// Define protected routes and their required roles
const protectedRoutes = {
  '/dashboard': 'USER',
  '/profile': 'USER',
  '/profile/security': 'USER',
  '/profile/sessions': 'USER',
  '/admin': 'ADMIN',
  '/admin/audit-logs': 'ADMIN',
  '/api/users': 'MODERATOR',
  '/api/users/profile': 'USER',
  '/organization': 'USER', // Org role checks happen at API level
  '/organization/members': 'USER',
  '/organization/invites': 'USER',
} as const

// Define auth routes that should redirect if already logged in
const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password']

// Define public routes that don't require authentication
// Note: /invite/[token] is public so unauthenticated users can view invites
const publicRoutes = ['/', '/verify-email']

// Define public API routes that don't require authentication
const publicApiRoutes = ['/api/invites']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply security headers to all requests
  const response = NextResponse.next()

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Add Content Security Policy
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)

  // Skip middleware for static files and API routes that don't need protection
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/invite/') || // Public invite pages
    publicApiRoutes.some(route => pathname.startsWith(route)) ||
    pathname.includes('.') ||
    publicRoutes.includes(pathname)
  ) {
    return response
  }

  try {
    // Get session
    const session = await getSessionFromRequest(request)
    const isAuthenticated = session.isLoggedIn && session.userId

    // Handle auth routes (redirect if already logged in)
    if (authRoutes.includes(pathname)) {
      if (isAuthenticated) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      return response
    }

    // Check if route is protected
    const requiredRole = protectedRoutes[pathname as keyof typeof protectedRoutes]

    if (requiredRole) {
      // Route requires authentication
      if (!isAuthenticated) {
        // Redirect to login with return URL
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('returnUrl', pathname)
        return NextResponse.redirect(loginUrl)
      }

      // For API routes, we'll let the route handler check permissions
      if (pathname.startsWith('/api/')) {
        return response
      }

      // For page routes, check role here if needed
      // This would require loading the user from the database
      // For now, we'll let the page components handle role checking
    }

    return response

  } catch (error) {
    console.error('Middleware error:', error)

    // If there's an error with the session, redirect to login for protected routes
    const isProtectedRoute = Object.keys(protectedRoutes).some(route =>
      pathname.startsWith(route)
    )

    if (isProtectedRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('returnUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}