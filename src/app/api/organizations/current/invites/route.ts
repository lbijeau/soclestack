import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OrganizationRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  hasOrgRole,
  generateInviteToken,
  createInviteExpiry,
} from '@/lib/organization';
import { AuthError } from '@/types/auth';
import { sendEmail, organizationInviteTemplate } from '@/lib/email';

export const runtime = 'nodejs';

const createInviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.nativeEnum(OrganizationRole).default('MEMBER'),
});

// GET /api/organizations/current/invites - List pending invites (ADMIN+)
export async function GET() {
  try {
    const session = await getSession();

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
            message: 'You do not have permission to view invites',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    const invites = await prisma.organizationInvite.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('Get invites error:', error);
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

// POST /api/organizations/current/invites - Send invite (ADMIN+)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

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
      include: { organization: true },
    });

    if (!user?.organization) {
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
            message: 'You do not have permission to invite members',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validationResult = createInviteSchema.safeParse(body);

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

    const { email, role } = validationResult.data;

    // Cannot invite with a role equal to or higher than current user's role
    if (hasOrgRole(role, user.organizationRole)) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'You cannot invite someone with your role or higher',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    const organizationId = user.organization.id;

    // Check if user already exists in the organization
    const existingMember = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        organizationId,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'This user is already a member of the organization',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Check for existing pending invite
    const existingInvite = await prisma.organizationInvite.findFirst({
      where: {
        email: email.toLowerCase(),
        organizationId,
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'An invite has already been sent to this email',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Create invite
    const token = generateInviteToken();
    const expiresAt = createInviteExpiry();

    const invite = await prisma.organizationInvite.create({
      data: {
        email: email.toLowerCase(),
        role,
        token,
        expiresAt,
        organizationId,
        invitedById: user.id,
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Send invite email
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`;
    const inviterName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

    const emailTemplate = organizationInviteTemplate({
      inviterName,
      organizationName: user.organization.name,
      inviteUrl,
      expiresAt,
    });

    await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error('Create invite error:', error);
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
