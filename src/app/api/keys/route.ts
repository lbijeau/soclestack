import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createApiKeySchema } from '@/lib/validations'
import { generateApiKey, hasReachedKeyLimit, getActiveKeyCount, MAX_KEYS_PER_USER } from '@/lib/api-keys'
import { logAuditEvent } from '@/lib/audit'
import { AuthError } from '@/types/auth'

export const runtime = 'nodejs'

// GET /api/keys - List user's API keys
export async function GET() {
  try {
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

    const keys = await prisma.apiKey.findMany({
      where: {
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
      orderBy: { createdAt: 'desc' },
    })

    const count = keys.length

    return NextResponse.json({
      keys,
      count,
      limit: MAX_KEYS_PER_USER,
    })
  } catch (error) {
    console.error('List API keys error:', error)
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

// POST /api/keys - Create new API key
export async function POST(req: NextRequest) {
  try {
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

    // Check key limit
    if (await hasReachedKeyLimit(currentUser.id)) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: `You have reached the maximum of ${MAX_KEYS_PER_USER} API keys`,
          } as AuthError,
        },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validationResult = createApiKeySchema.safeParse(body)
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
    const { key, keyHash, keyPrefix } = generateApiKey()

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: currentUser.id,
        name,
        keyHash,
        keyPrefix,
        permission,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permission: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // Log audit event
    await logAuditEvent({
      action: 'API_KEY_CREATED',
      category: 'security',
      userId: currentUser.id,
      metadata: {
        keyId: apiKey.id,
        keyName: name,
        keyPrefix,
        permission,
      },
    })

    // Get updated count
    const count = await getActiveKeyCount(currentUser.id)

    return NextResponse.json({
      key, // Only returned on creation!
      ...apiKey,
      count,
      limit: MAX_KEYS_PER_USER,
    })
  } catch (error) {
    console.error('Create API key error:', error)
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
