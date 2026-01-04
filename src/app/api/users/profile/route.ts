import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  getClientIP,
  isRateLimited,
  getCurrentUser,
} from '@/lib/auth';
import { updateProfileSchema, changePasswordSchema } from '@/lib/validations';
import {
  hashPassword,
  verifyPassword,
  generateResetToken,
  hashResetToken,
} from '@/lib/security';
import { prisma } from '@/lib/db';
import { AuthError } from '@/types/auth';
import { SECURITY_CONFIG } from '@/lib/config/security';
import { rotateCsrfToken } from '@/lib/csrf';
import {
  sendVerificationEmail,
  sendEmailChangedNotification,
} from '@/lib/email';
import { logAuditEvent } from '@/lib/audit';
import log from '@/lib/logger';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  try {
    // Check authentication (supports both session and API key)
    const auth = await requireAuth(req);
    if (!auth.success) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: auth.error,
          } as AuthError,
        },
        { status: auth.status }
      );
    }

    const body = await req.json();

    // Check if trying to change password
    if ('currentPassword' in body) {
      // Password changes require session authentication (not API key)
      // because they need to verify the current password
      if (auth.context.type === 'api_key') {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message:
                'Password changes are not allowed via API key. Please use the web interface.',
            } as AuthError,
          },
          { status: 403 }
        );
      }

      // For password changes, we need the full user object from session
      const currentUser = await getCurrentUser();
      if (!currentUser) {
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
      // Rate limit password changes
      const clientIP = getClientIP(req);
      const { limit, windowMs } = SECURITY_CONFIG.rateLimits.passwordChange;
      if (isRateLimited(`password-change:${clientIP}`, limit, windowMs)) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message:
                'Too many password change attempts. Please try again later.',
            } as AuthError,
          },
          { status: 429 }
        );
      }

      const validationResult = changePasswordSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Invalid input data',
              details: validationResult.error.flatten().fieldErrors,
            } as AuthError,
          },
          { status: 400 }
        );
      }

      const { currentPassword, newPassword } = validationResult.data;

      // OAuth-only users cannot change password this way
      if (!currentUser.password) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHENTICATION_ERROR',
              message:
                'Cannot change password. This account uses OAuth login only.',
            } as AuthError,
          },
          { status: 400 }
        );
      }

      // Verify current password
      const isCurrentPasswordValid = await verifyPassword(
        currentPassword,
        currentUser.password
      );
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHENTICATION_ERROR',
              message: 'Current password is incorrect',
            } as AuthError,
          },
          { status: 401 }
        );
      }

      // Check if new password is different from current
      const isSamePassword = await verifyPassword(
        newPassword,
        currentUser.password
      );
      if (isSamePassword) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message: 'New password must be different from current password',
            } as AuthError,
          },
          { status: 400 }
        );
      }

      // Check password history (prevent reusing last 3 passwords)
      const passwordHistory = await prisma.passwordHistory.findMany({
        where: { userId: currentUser.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      for (const oldPassword of passwordHistory) {
        const isOldPassword = await verifyPassword(
          newPassword,
          oldPassword.password
        );
        if (isOldPassword) {
          return NextResponse.json(
            {
              error: {
                type: 'VALIDATION_ERROR',
                message: 'Cannot reuse any of your last 3 passwords',
              } as AuthError,
            },
            { status: 400 }
          );
        }
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Store current password in history
      await prisma.passwordHistory.create({
        data: {
          userId: currentUser.id,
          password: currentUser.password,
        },
      });

      // Update password
      const updatedUser = await prisma.user.update({
        where: { id: currentUser.id },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Log password change
      log.auth.passwordChanged(currentUser.id);

      // Logout from all other devices for security
      await prisma.userSession.deleteMany({
        where: {
          userId: currentUser.id,
          // Keep current session active - you'd need to implement session tracking for this
        },
      });

      // Rotate CSRF token after password change
      const response = NextResponse.json({
        message: 'Password changed successfully',
        user: updatedUser,
      });
      rotateCsrfToken(response);
      return response;
    } else {
      // Update profile information (works with both session and API key auth)
      const validationResult = updateProfileSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Invalid input data',
              details: validationResult.error.flatten().fieldErrors,
            } as AuthError,
          },
          { status: 400 }
        );
      }

      const updateData = validationResult.data;

      // Fetch current user data for comparison
      const profileUser = await prisma.user.findUnique({
        where: { id: auth.user.id },
        select: { id: true, email: true, username: true, firstName: true },
      });

      if (!profileUser) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHENTICATION_ERROR',
              message: 'User not found',
            } as AuthError,
          },
          { status: 401 }
        );
      }

      // Check if email is being changed and if it's already taken
      if (updateData.email && updateData.email !== profileUser.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: updateData.email },
        });

        if (existingUser) {
          return NextResponse.json(
            {
              error: {
                type: 'VALIDATION_ERROR',
                message: 'This email is already taken',
                details: {
                  email: ['This email is already taken'],
                },
              } as AuthError,
            },
            { status: 409 }
          );
        }
      }

      // Check if username is being changed and if it's already taken
      if (updateData.username && updateData.username !== profileUser.username) {
        const existingUser = await prisma.user.findUnique({
          where: { username: updateData.username },
        });

        if (existingUser) {
          return NextResponse.json(
            {
              error: {
                type: 'VALIDATION_ERROR',
                message: 'This username is already taken',
                details: {
                  username: ['This username is already taken'],
                },
              } as AuthError,
            },
            { status: 409 }
          );
        }
      }

      // If email is being changed, mark as unverified and generate verification token
      let finalUpdateData: typeof updateData & {
        emailVerified?: boolean;
        emailVerifiedAt?: null;
        emailVerificationToken?: string;
        emailVerificationExpires?: Date;
      } = updateData;

      if (updateData.email && updateData.email !== profileUser.email) {
        const verificationToken = await generateResetToken();
        const hashedToken = await hashResetToken(verificationToken);
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        finalUpdateData = {
          ...updateData,
          emailVerified: false,
          emailVerifiedAt: null,
          emailVerificationToken: hashedToken,
          emailVerificationExpires: tokenExpiry,
        };

        // Log the email change for security audit
        logAuditEvent({
          action: 'SECURITY_EMAIL_CHANGED',
          category: 'security',
          userId: profileUser.id,
          metadata: {
            oldEmail: profileUser.email,
            newEmail: updateData.email,
          },
        }).catch((err) =>
          log.error('Failed to log email change', { error: err.message })
        );

        // Notify old email address about the change (fire-and-forget)
        sendEmailChangedNotification(
          profileUser.email,
          updateData.email,
          new Date()
        ).catch((err) =>
          log.email.failed('email_changed', profileUser.email, err)
        );

        // Send verification email to new address (fire-and-forget)
        sendVerificationEmail(
          updateData.email,
          verificationToken,
          profileUser.firstName || profileUser.username || undefined
        ).catch((err) =>
          log.email.failed('verification', updateData.email!, err)
        );
      }

      const updatedUser = await prisma.user.update({
        where: { id: profileUser.id },
        data: finalUpdateData,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({
        message: 'Profile updated successfully',
        user: updatedUser,
      });
    }
  } catch (error) {
    log.error('Update profile error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}
