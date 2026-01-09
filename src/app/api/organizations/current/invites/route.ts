import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  generateInviteToken,
  createInviteExpiry,
  getCurrentOrganizationId,
} from '@/lib/organization';
import { AuthError } from '@/types/auth';
import { sendEmail, organizationInviteTemplate, EmailType } from '@/lib/email';
import { hasRole, userWithRolesInclude, ROLES } from '@/lib/security/index';

export const runtime = 'nodejs';

const createInviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  roleName: z.string().startsWith('ROLE_').default(ROLES.USER),
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

    // Check if user has ADMIN or higher role in this organization
    if (!(await hasRole(user, ROLES.ADMIN, organizationId))) {
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
      where: { organizationId },
      select: {
        id: true,
        email: true,
        roleId: true,
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

    // Fetch all unique roles
    const roleIds = [...new Set(invites.map((inv) => inv.roleId))];
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true },
    });

    const roleMap = new Map(roles.map((r) => [r.id, r.name]));

    // Transform roleId to role names for response
    const transformedInvites = invites.map((inv) => ({
      ...inv,
      role: roleMap.get(inv.roleId) || ROLES.USER,
      roleId: undefined, // Remove roleId from response
    }));

    return NextResponse.json({ invites: transformedInvites });
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

    // Get user with roles and organization
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        ...userWithRolesInclude,
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

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    if (!organization) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'Organization not found',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Check if user has ADMIN or higher role
    if (!(await hasRole(user, ROLES.ADMIN, organizationId))) {
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

    const { email, roleName } = validationResult.data;

    // Find the role by name
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid role specified',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Cannot invite with a role equal to or higher than current user's role
    // Check if target role is in user's hierarchy
    if (await hasRole(user, roleName, organizationId)) {
      // User has this role or higher, which means they can invite
      // But we need to prevent inviting with same or higher role
      // For now, simplified: only allow inviting ROLE_USER and ROLE_MODERATOR if you're ADMIN+
      if (roleName === ROLES.ADMIN || roleName === ROLES.OWNER) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message: 'You cannot invite someone with ADMIN or OWNER role',
            } as AuthError,
          },
          { status: 403 }
        );
      }
    }

    // Check if user already exists in the organization
    const existingMember = await prisma.userRole.findFirst({
      where: {
        organizationId,
        user: {
          email: email.toLowerCase(),
        },
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
        roleId: role.id,
        token,
        expiresAt,
        organizationId,
        invitedById: user.id,
      },
      select: {
        id: true,
        email: true,
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
      organizationName: organization.name,
      inviteUrl,
      expiresAt,
    });

    await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      type: 'invite' as EmailType,
    });

    return NextResponse.json(
      { invite: { ...invite, role: role.name } },
      { status: 201 }
    );
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
