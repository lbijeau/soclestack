import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, isRateLimited } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { generateResetToken } from '@/lib/security';
import { AuthError } from '@/types/auth';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Email is already verified',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Rate limit: 3 resend attempts per hour
    const rateLimitKey = `resend-verification:${user.id}`;
    if (isRateLimited(rateLimitKey, 3, 60 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message:
              'Too many verification emails sent. Please try again later.',
          } as AuthError,
        },
        { status: 429 }
      );
    }

    // Generate new verification token
    const verificationToken = await generateResetToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: tokenExpiry,
      },
    });

    // Send verification email
    await sendVerificationEmail(
      user.email,
      verificationToken,
      user.firstName || user.username || undefined
    );

    return NextResponse.json({
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to send verification email',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}
