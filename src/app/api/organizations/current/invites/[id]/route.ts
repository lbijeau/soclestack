import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasOrgRole } from '@/lib/organization';
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

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, organizationRole: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'You do not belong to an organization',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Check if user has ADMIN or higher role
    if (!hasOrgRole(user.organizationRole, 'ADMIN')) {
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

    if (!invite || invite.organizationId !== user.organizationId) {
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
