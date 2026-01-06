import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCurrentOrganizationId } from '@/lib/organization';
import { hasRole, userWithRolesInclude } from '@/lib/security/index';
import { AuthError } from '@/types/auth';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/organizations/current/invites/[id] - Cancel invite (ADMIN+)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: inviteId } = await params;

    if (!session.isLoggedIn || !session.userId) {
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

    // Get current organization ID
    const organizationId = await getCurrentOrganizationId(session.userId);

    if (!organizationId) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message:
              'You do not belong to an organization or belong to multiple organizations',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Get user with roles for authorization check
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, ...userWithRolesInclude },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'NOT_FOUND', message: 'User not found' } as AuthError,
        },
        { status: 404 }
      );
    }

    // Check if user has ADMIN or higher role
    if (!(await hasRole(user, 'ROLE_ADMIN', organizationId))) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'You do not have permission to cancel invites',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Find the invite
    const invite = await prisma.organizationInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.organizationId !== organizationId) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'Invite not found',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Delete the invite
    await prisma.organizationInvite.delete({
      where: { id: inviteId },
    });

    return NextResponse.json({ message: 'Invite cancelled successfully' });
  } catch (error) {
    console.error('Cancel invite error:', error);
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
