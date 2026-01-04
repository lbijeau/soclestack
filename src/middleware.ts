import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest, getUserByIdWithRoles } from '@/lib/auth';
import { getSecurityHeaders, buildCSP } from '@/lib/security-headers';
import {
  requiresCsrfValidation,
  isRouteExcludedFromCsrf,
  hasValidApiKeyHeader,
  validateCsrfRequest,
  createCsrfErrorResponse,
  isCsrfRateLimited,
  recordCsrfFailure,
  createCsrfRateLimitResponse,
} from '@/lib/csrf';
import { isGranted, ROLES, type RoleName } from '@/lib/security/index';

// Use Node.js runtime instead of Edge Runtime.
// Trade-off: Slightly higher latency and cold starts, but required for:
// - Prisma database access (role hierarchy lookups)
// - isGranted() authorization checks
export const runtime = 'nodejs';

// Protected routes and their required roles.
// Sorted by path length (longest first) to ensure specific routes match before general ones.
// E.g., /profile/security matches before /profile
const protectedRoutes = [
  ['/admin/organizations', ROLES.ADMIN],
  ['/admin/audit-logs', ROLES.ADMIN],
  ['/organization/members', ROLES.USER],
  ['/organization/invites', ROLES.USER],
  ['/profile/security', ROLES.USER],
  ['/profile/sessions', ROLES.USER],
  ['/api/users/profile', ROLES.USER],
  ['/organization', ROLES.USER],
  ['/dashboard', ROLES.USER],
  ['/api/users', ROLES.MODERATOR],
  ['/profile', ROLES.USER],
  ['/admin', ROLES.ADMIN],
] as const;

// Define auth routes that should redirect if already logged in
const authRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

// Define OAuth routes that are public (part of auth flow)
const oauthRoutes = [
  '/auth/oauth/complete',
  '/auth/oauth/link',
  '/auth/two-factor',
];

// Define public routes that don't require authentication
// Note: /invite/[token] is public so unauthenticated users can view invites
const publicRoutes = ['/', '/verify-email'];

// Define public API routes that don't require authentication
const publicApiRoutes = ['/api/invites'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate unique nonce for this request (used for CSP)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Apply security headers to all requests
  const response = NextResponse.next();

  // Pass nonce to downstream via header (for components that need it)
  response.headers.set('x-nonce', nonce);

  // Add security headers (HSTS disabled in dev to allow HTTP)
  const isDev = process.env.NODE_ENV === 'development';
  Object.entries(getSecurityHeaders(isDev)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add Content Security Policy with per-request nonce
  response.headers.set('Content-Security-Policy', buildCSP(nonce, isDev));

  // CSRF validation for state-changing requests
  if (
    pathname.startsWith('/api/') &&
    requiresCsrfValidation(request.method) &&
    !isRouteExcludedFromCsrf(pathname) &&
    !hasValidApiKeyHeader(request)
  ) {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Check if already rate limited before validation
    if (isCsrfRateLimited(clientIp)) {
      console.warn(
        `CSRF rate limit exceeded`,
        `ip=${clientIp}`,
        `path=${pathname}`,
        `method=${request.method}`
      );
      return createCsrfRateLimitResponse();
    }

    const csrfResult = validateCsrfRequest(request);
    if (!csrfResult.valid) {
      const requestId =
        request.headers.get('x-request-id') || crypto.randomUUID();

      // Record failure and check if now rate limited
      const isNowRateLimited = recordCsrfFailure(clientIp);

      console.warn(
        `CSRF validation failed: ${csrfResult.error}`,
        `requestId=${requestId}`,
        `path=${pathname}`,
        `method=${request.method}`,
        `ip=${clientIp}`,
        `ua=${request.headers.get('user-agent') || 'unknown'}`,
        `rateLimited=${isNowRateLimited}`
      );

      if (isNowRateLimited) {
        return createCsrfRateLimitResponse();
      }

      return createCsrfErrorResponse(csrfResult.error);
    }
  }

  // Skip middleware for static files and API routes that don't need protection
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/invite/') || // Public invite pages
    publicApiRoutes.some((route) => pathname.startsWith(route)) ||
    oauthRoutes.includes(pathname) || // OAuth flow pages
    pathname.includes('.') ||
    publicRoutes.includes(pathname)
  ) {
    return response;
  }

  try {
    // Get session
    const session = await getSessionFromRequest(request);
    const isAuthenticated = session.isLoggedIn && session.userId;

    // Handle auth routes (redirect if already logged in)
    if (authRoutes.includes(pathname)) {
      if (isAuthenticated) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      return response;
    }

    // Check if route is protected (exact match or prefix match for nested routes)
    // Routes are pre-sorted by length, so first match wins
    let requiredRole: RoleName | undefined;
    for (const [route, role] of protectedRoutes) {
      if (pathname === route || pathname.startsWith(route + '/')) {
        requiredRole = role;
        break;
      }
    }

    if (requiredRole) {
      // Route requires authentication
      if (!isAuthenticated) {
        // Redirect to login with return URL
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('returnUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // For API routes, let the route handler check permissions
      // (API routes use isGranted directly with more context)
      if (pathname.startsWith('/api/')) {
        return response;
      }

      // For page routes, check role using isGranted
      const user = await getUserByIdWithRoles(session.userId!);
      if (!user || !(await isGranted(user, requiredRole))) {
        // User lacks required role - redirect to dashboard with error
        const dashboardUrl = new URL('/dashboard', request.url);
        dashboardUrl.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(dashboardUrl);
      }
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);

    // If there's an error with the session, redirect to login for protected routes
    const isProtectedRoute = protectedRoutes.some(([route]) =>
      pathname.startsWith(route)
    );

    if (isProtectedRoute) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
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
};
