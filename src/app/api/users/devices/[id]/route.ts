import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, getClientIP } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export const runtime = 'nodejs'

// DELETE /api/users/devices/[id] - Revoke a trusted device
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { type: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const { id } = await params

    // Find the token
    const token = await prisma.rememberMeToken.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!token) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Device not found' } },
        { status: 404 }
      )
    }

    // Delete the token
    await prisma.rememberMeToken.delete({
      where: { id },
    })

    // Log the revocation
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || undefined
    await logAuditEvent({
      userId: user.id,
      action: 'SECURITY_DEVICE_REVOKED',
      category: 'security',
      ipAddress: clientIP,
      userAgent,
      metadata: {
        revokedDeviceId: id,
        revokedDeviceIp: token.ipAddress,
      },
    })

    return NextResponse.json({ success: true, message: 'Device revoked successfully' })
  } catch (error) {
    console.error('Failed to revoke device:', error)
    return NextResponse.json(
      { error: { type: 'INTERNAL_ERROR', message: 'Failed to revoke device' } },
      { status: 500 }
    )
  }
}
