import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { createUserSession, getClientIP } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { generateSlug } from '@/lib/organization';
import { verifyPendingOAuthToken } from '@/lib/auth/oauth';
import { z } from 'zod';
import { generateCsrfToken, CSRF_CONFIG } from '@/lib/csrf';
import { ROLES } from '@/lib/security/index';

const completeOAuthSchema = z
  .object({
    token: z.string().min(1, 'Token is required'),
    organizationName: z.string().min(2).max(100).optional(),
    inviteToken: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasOrgName = !!data.organizationName;
      const hasInvite = !!data.inviteToken;
      return hasOrgName !== hasInvite; // XOR: exactly one must be true
    },
    {
      message:
        'You must either create a new organization or use an invite token',
      path: ['organizationName'],
    }
  );

export async function POST(req: NextRequest) {
  const ipAddress = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const body = await req.json();
    const validation = completeOAuthSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { token, organizationName, inviteToken } = validation.data;

    // Verify pending OAuth token
    const oauthData = await verifyPendingOAuthToken(token);
    if (!oauthData) {
      return NextResponse.json(
        {
          error: {
            type: 'INVALID_TOKEN',
            message: 'OAuth session expired. Please try again.',
          },
        },
        { status: 400 }
      );
    }

    // Check if user already exists (email could be taken by now)
    const existingUser = await prisma.user.findUnique({
      where: { email: oauthData.profile.email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: {
            type: 'CONFLICT',
            message:
              'An account with this email already exists. Please log in instead.',
          },
        },
        { status: 409 }
      );
    }

    // Check if OAuth account already linked
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: oauthData.provider,
          providerAccountId: oauthData.providerAccountId,
        },
      },
    });

    if (existingOAuth) {
      return NextResponse.json(
        {
          error: {
            type: 'CONFLICT',
            message: 'This OAuth account is already linked to another user.',
          },
        },
        { status: 409 }
      );
    }

    // Handle invite token if provided
    let invite = null;
    if (inviteToken) {
      invite = await prisma.organizationInvite.findUnique({
        where: { token: inviteToken },
        include: { organization: true },
      });

      if (!invite) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Invalid or expired invite token',
            },
          },
          { status: 400 }
        );
      }

      if (invite.expiresAt < new Date()) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message: 'This invite has expired',
            },
          },
          { status: 400 }
        );
      }

      // Verify email matches the invite
      if (
        invite.email.toLowerCase() !== oauthData.profile.email.toLowerCase()
      ) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Your email does not match the invite',
            },
          },
          { status: 400 }
        );
      }
    }

    // Create user with organization and OAuth account (transaction)
    const userId = await prisma.$transaction(async (tx) => {
      // Create the user (no password for OAuth-only users)
      const newUser = await tx.user.create({
        data: {
          email: oauthData.profile.email,
          firstName: oauthData.profile.firstName,
          lastName: oauthData.profile.lastName,
          emailVerified: oauthData.profile.emailVerified,
          emailVerifiedAt: oauthData.profile.emailVerified ? new Date() : null,
          lastLoginAt: new Date(),
        },
      });

      if (organizationName) {
        // Create new organization with user as ROLE_OWNER
        const slug = await generateSlug(organizationName);
        const organization = await tx.organization.create({
          data: { name: organizationName, slug },
        });

        // Find ROLE_OWNER role
        const ownerRole = await tx.role.findUnique({
          where: { name: ROLES.OWNER },
        });

        if (!ownerRole) {
          throw new Error(`${ROLES.OWNER} not found in database`);
        }

        // Create UserRole linking user to organization as owner
        await tx.userRole.create({
          data: {
            userId: newUser.id,
            roleId: ownerRole.id,
            organizationId: organization.id,
          },
        });
      } else if (invite) {
        // Create UserRole with invite's role and organization
        await tx.userRole.create({
          data: {
            userId: newUser.id,
            roleId: invite.roleId,
            organizationId: invite.organizationId,
          },
        });

        // Delete the invite
        await tx.organizationInvite.delete({
          where: { id: invite.id },
        });
      }

      // Create OAuth account link
      await tx.oAuthAccount.create({
        data: {
          userId: newUser.id,
          provider: oauthData.provider,
          providerAccountId: oauthData.providerAccountId,
          email: oauthData.profile.email,
          accessToken: oauthData.accessToken,
          refreshToken: oauthData.refreshToken,
          tokenExpiresAt: oauthData.tokenExpiresAt
            ? new Date(oauthData.tokenExpiresAt * 1000)
            : null,
        },
      });

      return newUser.id;
    });

    // Fetch user with userRoles for session creation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          select: {
            id: true,
            createdAt: true,
            userId: true,
            roleId: true,
            organizationId: true,
            role: {
              select: {
                id: true,
                name: true,
                parentId: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found after creation');
    }

    // Create session
    await createUserSession(
      user as Parameters<typeof createUserSession>[0],
      ipAddress,
      userAgent
    );

    await logAuditEvent({
      action: 'AUTH_OAUTH_REGISTRATION',
      category: 'authentication',
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: { provider: oauthData.provider },
    });

    // Set CSRF token cookie
    const csrfToken = generateCsrfToken();
    const cookieStore = await cookies();
    cookieStore.set(
      CSRF_CONFIG.cookieName,
      csrfToken,
      CSRF_CONFIG.cookieOptions
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error('OAuth registration error:', error);
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
}
