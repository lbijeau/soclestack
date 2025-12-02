import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { AuthError } from '@/types/auth'
import { z } from 'zod'

export const runtime = 'nodejs'

const updateNotificationsSchema = z.object({
  notifyNewDevice: z.boolean().optional(),
  notifyPasswordChange: z.boolean().optional(),
  notifyLoginAlert: z.boolean().optional(),
  notify2FAChange: z.boolean().optional(),
})

// GET - Get current notification preferences
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      )
    }

    const preferences = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        notifyNewDevice: true,
        notifyPasswordChange: true,
        notifyLoginAlert: true,
        notify2FAChange: true,
      },
    })

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Get notification preferences error:', error)
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to get notification preferences',
        } as AuthError,
      },
      { status: 500 }
    )
  }
}

// PATCH - Update notification preferences
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      )
    }

    const body = await req.json()
    const validationResult = updateNotificationsSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          } as AuthError,
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        notifyNewDevice: true,
        notifyPasswordChange: true,
        notifyLoginAlert: true,
        notify2FAChange: true,
      },
    })

    return NextResponse.json({
      message: 'Notification preferences updated',
      preferences: updated,
    })
  } catch (error) {
    console.error('Update notification preferences error:', error)
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to update notification preferences',
        } as AuthError,
      },
      { status: 500 }
    )
  }
}
