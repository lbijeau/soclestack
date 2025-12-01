import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { OrganizationRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { hasOrgRole, canManageUser } from '@/lib/organization'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

const updateMemberSchema = z.object({
  role: z.nativeEnum(OrganizationRole),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/organizations/current/members/[id] - Update member role (ADMIN+)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    const { id: memberId } = await params

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } as AuthError },
        { status: 401 }
      )
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, organizationRole: true }
    })

    if (!currentUser?.organizationId) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'You do not belong to an organization' } as AuthError },
        { status: 404 }
      )
    }

    // Check if user has ADMIN or higher role
    if (!hasOrgRole(currentUser.organizationRole, 'ADMIN')) {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'You do not have permission to manage members' } as AuthError },
        { status: 403 }
      )
    }

    // Find the target member
    const targetMember = await prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, organizationId: true, organizationRole: true }
    })

    if (!targetMember || targetMember.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Member not found' } as AuthError },
        { status: 404 }
      )
    }

    // Check if current user can manage target member
    const isSelf = session.userId === memberId
    if (!canManageUser(currentUser.organizationRole, targetMember.organizationRole, isSelf)) {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'You cannot manage this member' } as AuthError },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validationResult = updateMemberSchema.safeParse(body)

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

    const { role } = validationResult.data

    // Prevent promoting to a role equal to or higher than current user's role
    if (hasOrgRole(role, currentUser.organizationRole)) {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'You cannot promote a member to your role or higher' } as AuthError },
        { status: 403 }
      )
    }

    // Special check: cannot change OWNER role (only transfer ownership via separate endpoint)
    if (targetMember.organizationRole === 'OWNER') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Cannot change the owner\'s role directly' } as AuthError },
        { status: 403 }
      )
    }

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: { organizationRole: role },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        organizationRole: true,
      }
    })

    return NextResponse.json({ member: updatedMember })

  } catch (error) {
    console.error('Update member error:', error)
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'An internal server error occurred' } as AuthError },
      { status: 500 }
    )
  }
}

// DELETE /api/organizations/current/members/[id] - Remove member from organization (ADMIN+)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    const { id: memberId } = await params

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } as AuthError },
        { status: 401 }
      )
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, organizationRole: true }
    })

    if (!currentUser?.organizationId) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'You do not belong to an organization' } as AuthError },
        { status: 404 }
      )
    }

    // Check if user has ADMIN or higher role
    if (!hasOrgRole(currentUser.organizationRole, 'ADMIN')) {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'You do not have permission to manage members' } as AuthError },
        { status: 403 }
      )
    }

    // Find the target member
    const targetMember = await prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, organizationId: true, organizationRole: true }
    })

    if (!targetMember || targetMember.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Member not found' } as AuthError },
        { status: 404 }
      )
    }

    // Check if current user can manage target member
    const isSelf = session.userId === memberId
    if (!canManageUser(currentUser.organizationRole, targetMember.organizationRole, isSelf)) {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'You cannot remove this member' } as AuthError },
        { status: 403 }
      )
    }

    // Cannot remove the owner
    if (targetMember.organizationRole === 'OWNER') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Cannot remove the organization owner' } as AuthError },
        { status: 403 }
      )
    }

    // Remove member from organization
    await prisma.user.update({
      where: { id: memberId },
      data: {
        organizationId: null,
        organizationRole: 'MEMBER'
      }
    })

    return NextResponse.json({ message: 'Member removed successfully' })

  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'An internal server error occurred' } as AuthError },
      { status: 500 }
    )
  }
}
