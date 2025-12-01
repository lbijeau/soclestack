import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getClientIP, isRateLimited } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateApiKeySchema } from '@/lib/validations'
import { logAuditEvent } from '@/lib/audit'
import { AuthError } from '@/types/auth'
import { SECURITY_CONFIG } from '@/lib/config/security'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/keys/[id] - Get single API key
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
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

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: currentUser.id,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permission: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })

    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'API key not found',
          } as AuthError,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(apiKey)
  } catch (error) {
    console.error('Get API key error:', error)
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    )
  }
}

// PATCH /api/keys/[id] - Update API key
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
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

    // Check key exists and belongs to user
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: currentUser.id,
        revokedAt: null,
      },
    })

    if (!existingKey) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'API key not found',
          } as AuthError,
        },
        { status: 404 }
      )
    }

    const body = await req.json()
    const validationResult = updateApiKeySchema.safeParse(body)
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
      )
    }

    const { name, permission, expiresAt } = validationResult.data

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (permission !== undefined) updateData.permission = permission
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null

    const updatedKey = await prisma.apiKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permission: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })

    // Log audit event
    await logAuditEvent({
      action: 'API_KEY_UPDATED',
      category: 'security',
      userId: currentUser.id,
      metadata: {
        keyId: id,
        keyPrefix: existingKey.keyPrefix,
        changes: Object.keys(updateData),
      },
    })

    return NextResponse.json(updatedKey)
  } catch (error) {
    console.error('Update API key error:', error)
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    )
  }
}

// DELETE /api/keys/[id] - Revoke API key (soft delete)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req)
    const { limit, windowMs } = SECURITY_CONFIG.rateLimits.apiKeyRevoke
    if (isRateLimited(`apikey-revoke:${clientIP}`, limit, windowMs)) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Too many requests. Please try again later.',
          } as AuthError,
        },
        { status: 429 }
      )
    }

    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
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

    // Check key exists and belongs to user
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: currentUser.id,
        revokedAt: null,
      },
    })

    if (!existingKey) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'API key not found',
          } as AuthError,
        },
        { status: 404 }
      )
    }

    // Soft delete by setting revokedAt
    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })

    // Log audit event
    await logAuditEvent({
      action: 'API_KEY_REVOKED',
      category: 'security',
      userId: currentUser.id,
      metadata: {
        keyId: id,
        keyName: existingKey.name,
        keyPrefix: existingKey.keyPrefix,
      },
    })

    return NextResponse.json({
      message: 'API key revoked successfully',
    })
  } catch (error) {
    console.error('Revoke API key error:', error)
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    )
  }
}
