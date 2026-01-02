import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AuthError } from '@/types/auth';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST /api/invites/[token]/accept - Accept invite (authenticated user)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { token } = await params;

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'You must be logged in to accept an invite',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        organizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'NOT_FOUND', message: 'User not found' } as AuthError,
        },
        { status: 404 }
      );
    }

    // Check if user already belongs to an organization
    if (user.organizationId) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message:
              'You already belong to an organization. Leave your current organization before accepting a new invite.',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Find the invite
    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'Invite not found or has been cancelled',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'This invite has expired',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Verify email matches the invite
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'This invite was sent to a different email address',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Accept the invite in transaction
    await prisma.$transaction(async (tx) => {
      // Update user to join organization
      await tx.user.update({
        where: { id: user.id },
        data: {
          organizationId: invite.organizationId,
          organizationRole: invite.role,
        },
      });

      // Delete the invite
      await tx.organizationInvite.delete({
        where: { id: invite.id },
      });
    });

    return NextResponse.json({
      message: 'Successfully joined the organization',
      organization: {
        id: invite.organization.id,
        name: invite.organization.name,
        slug: invite.organization.slug,
        role: invite.role,
      },
    });
  } catch (error) {
    console.error('Accept invite error:', error);
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
