import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AuthError } from '@/types/auth';
import { ROLES } from '@/lib/security/index';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET /api/invites/[token] - Get invite details (public)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

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
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
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

    // Fetch the role separately using roleId
    const role = await prisma.role.findUnique({
      where: { id: invite.roleId },
      select: { name: true },
    });

    const inviterName =
      invite.invitedBy.firstName && invite.invitedBy.lastName
        ? `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}`
        : invite.invitedBy.email;

    return NextResponse.json({
      invite: {
        email: invite.email,
        role: role?.name || ROLES.USER,
        expiresAt: invite.expiresAt,
        organization: invite.organization,
        invitedBy: inviterName,
      },
    });
  } catch (error) {
    console.error('Get invite error:', error);
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
