import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { hasOrgRole } from '@/lib/organization'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

const updateOrganizationSchema = z.object({
  name: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be at most 100 characters')
    .optional(),
})

// GET /api/organizations/current - Get current user's organization
export async function GET() {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } as AuthError },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        organization: {
          include: {
            _count: { select: { users: true } }
          }
        }
      }
    })

    if (!user?.organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'You do not belong to an organization' } as AuthError },
        { status: 404 }
      )
    }

    return NextResponse.json({
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        memberCount: user.organization._count.users,
        role: user.organizationRole,
        createdAt: user.organization.createdAt,
      }
    })

  } catch (error) {
    console.error('Get organization error:', error)
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'An internal server error occurred' } as AuthError },
      { status: 500 }
    )
  }
}

// PATCH /api/organizations/current - Update organization (ADMIN+)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } as AuthError },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { organization: true }
    })

    if (!user?.organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'You do not belong to an organization' } as AuthError },
        { status: 404 }
      )
    }

    // Check if user has ADMIN or higher role
    if (!hasOrgRole(user.organizationRole, 'ADMIN')) {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'You do not have permission to update this organization' } as AuthError },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validationResult = updateOrganizationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: validationResult.error.flatten().fieldErrors
          } as AuthError
        },
        { status: 400 }
      )
    }

    const { name } = validationResult.data

    const updatedOrg = await prisma.organization.update({
      where: { id: user.organization.id },
      data: {
        ...(name && { name })
      }
    })

    return NextResponse.json({
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        slug: updatedOrg.slug,
        role: user.organizationRole,
      }
    })

  } catch (error) {
    console.error('Update organization error:', error)
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'An internal server error occurred' } as AuthError },
      { status: 500 }
    )
  }
}

// DELETE /api/organizations/current - Delete organization (OWNER only)
export async function DELETE() {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } as AuthError },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { organization: true }
    })

    if (!user?.organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'You do not belong to an organization' } as AuthError },
        { status: 404 }
      )
    }

    // Only OWNER can delete the organization
    if (user.organizationRole !== 'OWNER') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Only the owner can delete the organization' } as AuthError },
        { status: 403 }
      )
    }

    // Delete organization and disassociate all users in transaction
    await prisma.$transaction(async (tx) => {
      // Remove organization from all users
      await tx.user.updateMany({
        where: { organizationId: user.organization!.id },
        data: {
          organizationId: null,
          organizationRole: 'MEMBER'
        }
      })

      // Delete all invites
      await tx.organizationInvite.deleteMany({
        where: { organizationId: user.organization!.id }
      })

      // Delete the organization
      await tx.organization.delete({
        where: { id: user.organization!.id }
      })
    })

    return NextResponse.json({ message: 'Organization deleted successfully' })

  } catch (error) {
    console.error('Delete organization error:', error)
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'An internal server error occurred' } as AuthError },
      { status: 500 }
    )
  }
}
