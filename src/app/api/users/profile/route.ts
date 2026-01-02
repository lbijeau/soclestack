import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getClientIP, isRateLimited } from '@/lib/auth';
import { updateProfileSchema, changePasswordSchema } from '@/lib/validations';
import { hashPassword, verifyPassword } from '@/lib/security';
import { prisma } from '@/lib/db';
import { AuthError } from '@/types/auth';
import { SECURITY_CONFIG } from '@/lib/config/security';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  try {
    // Check authentication
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

    const body = await req.json();

    // Check if trying to change password
    if ('currentPassword' in body) {
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

      // Logout from all other devices for security
      await prisma.userSession.deleteMany({
        where: {
          userId: currentUser.id,
          // Keep current session active - you'd need to implement session tracking for this
        },
      });

      return NextResponse.json({
        message: 'Password changed successfully',
        user: updatedUser,
      });
    } else {
      // Update profile information
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

      // Check if email is being changed and if it's already taken
      if (updateData.email && updateData.email !== currentUser.email) {
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

        // TODO: Send email verification
      }

      // Check if username is being changed and if it's already taken
      if (updateData.username && updateData.username !== currentUser.username) {
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

      // If email is being changed, mark as unverified
      const finalUpdateData =
        updateData.email && updateData.email !== currentUser.email
          ? { ...updateData, emailVerified: false, emailVerifiedAt: null }
          : updateData;

      const updatedUser = await prisma.user.update({
        where: { id: currentUser.id },
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
    console.error('Update profile error:', error);
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
