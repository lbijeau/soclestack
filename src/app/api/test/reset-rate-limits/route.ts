import { NextResponse } from 'next/server';
import { resetRateLimiter } from '@/lib/rate-limiter';
import { rateLimitStore } from '@/lib/auth';
import { _resetRateLimitState as resetCsrfRateLimits } from '@/lib/csrf';

/**
 * Test-only endpoint to reset rate limits.
 * Only available in development and test environments.
 */
export async function POST() {
  // Only allow in development, test environments, or when E2E_TEST is set
  const isTestEnv =
    process.env.NODE_ENV !== 'production' || process.env.E2E_TEST === 'true';

  if (!isTestEnv) {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 404 }
    );
  }

  try {
    // Reset the async rate limiter (Redis/Memory)
    await resetRateLimiter();

    // Reset the auth rate limit store (used for login/register)
    rateLimitStore.clear();

    // Reset the CSRF rate limit store
    resetCsrfRateLimits();

    return NextResponse.json({ success: true, message: 'Rate limits reset' });
  } catch (error) {
    console.error('Failed to reset rate limits:', error);
    return NextResponse.json(
      { error: 'Failed to reset rate limits' },
      { status: 500 }
    );
  }
}
