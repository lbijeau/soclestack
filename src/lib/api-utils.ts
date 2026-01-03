/**
 * API Utility Functions
 *
 * Shared utilities for route handlers including error handling
 * and request context extraction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServiceError, RateLimitError } from '@/services/auth.errors';
import { getClientIP } from './auth';
import { setRateLimitHeaders } from './rate-limit-headers';

/**
 * Request context passed to service functions.
 * Contains client information extracted from the request.
 */
export interface RequestContext {
  clientIP: string;
  userAgent?: string;
  /** Whether the current session is impersonating another user */
  isImpersonating?: boolean;
}

/**
 * Extract request context from a NextRequest.
 */
export function getRequestContext(req: NextRequest): RequestContext {
  return {
    clientIP: getClientIP(req),
    userAgent: req.headers.get('user-agent') || undefined,
  };
}

/**
 * Handle service errors and map them to HTTP responses.
 *
 * @param error - The error thrown by a service function
 * @returns NextResponse with appropriate status code and error body
 */
export function handleServiceError(error: unknown): NextResponse {
  if (error instanceof ServiceError) {
    const body: Record<string, unknown> = {
      error: {
        type: error.type,
        message: error.message,
        ...(error.details || {}),
      },
    };

    const response = NextResponse.json(body, { status: error.statusCode });

    // Add rate limit headers for rate limit errors
    if (error instanceof RateLimitError && error.rateLimitInfo) {
      setRateLimitHeaders(response.headers, {
        ...error.rateLimitInfo,
        remaining: 0,
      });
    }

    return response;
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  return NextResponse.json(
    {
      error: {
        type: 'SERVER_ERROR',
        message: 'An internal server error occurred',
      },
    },
    { status: 500 }
  );
}
