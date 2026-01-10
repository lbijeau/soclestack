import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Allowed origins for SDK cross-origin requests.
 * Configure via CORS_ORIGINS environment variable (comma-separated).
 */
export function getAllowedOrigins(): string[] {
  const origins = env.CORS_ORIGINS;
  if (!origins) {
    return [];
  }
  return origins.split(',').map((o) => o.trim());
}

/**
 * Check if wildcard CORS is configured.
 * Wildcard mode does not support credentials per CORS spec.
 */
export function isWildcardCors(): boolean {
  return getAllowedOrigins().includes('*');
}

/**
 * Check if origin is allowed for CORS
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) return false;

  // Check for wildcard
  if (allowedOrigins.includes('*')) return true;

  return allowedOrigins.includes(origin);
}

/**
 * Add CORS headers to response.
 * Note: When wildcard '*' is configured, credentials are NOT allowed per CORS spec.
 * Use explicit origins if you need credentials (cookies, Authorization header).
 */
export function addCorsHeaders(
  response: NextResponse,
  origin: string
): NextResponse {
  const wildcard = isWildcardCors();

  // Use '*' for wildcard mode, otherwise echo the specific origin
  response.headers.set(
    'Access-Control-Allow-Origin',
    wildcard ? '*' : origin
  );

  // Credentials only allowed with explicit origins, not wildcard
  if (!wildcard) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-CSRF-Token'
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightRequest(origin: string): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response, origin);
}
