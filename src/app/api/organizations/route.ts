import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateSlug } from '@/lib/organization'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

const createOrganizationSchema = z.object({
  name: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be at most 100 characters'),
})

// POST /api/organizations - Create a new organization (for existing users without one)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } as AuthError },
        { status: 401 }
      )
    }

    // Check if user already has an organization
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true }
    })

    if (user?.organizationId) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'You already belong to an organization' } as AuthError },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validationResult = createOrganizationSchema.safeParse(body)

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
    const slug = await generateSlug(name)

    // Create organization and update user in transaction
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name, slug }
      })

      await tx.user.update({
        where: { id: session.userId },
        data: {
          organizationId: org.id,
          organizationRole: 'OWNER'
        }
      })

      return org
    })

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: 'OWNER'
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Create organization error:', error)
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'An internal server error occurred' } as AuthError },
      { status: 500 }
    )
  }
}
