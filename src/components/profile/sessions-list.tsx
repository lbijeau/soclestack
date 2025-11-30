'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'

interface Session {
  id: string
  series: string
  ipAddress: string | null
  userAgent: string | null
  lastUsedAt: string
  createdAt: string
}

interface SessionsListProps {
  sessions: Session[]
  userId: string
  currentSeries?: string
}

function parseUserAgent(userAgent: string | null): { browser: string; os: string } {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown' }
  }

  let browser = 'Unknown'
  let os = 'Unknown'

  // Detect browser
  if (userAgent.includes('Firefox')) {
    browser = 'Firefox'
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge'
  } else if (userAgent.includes('Chrome')) {
    browser = 'Chrome'
  } else if (userAgent.includes('Safari')) {
    browser = 'Safari'
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows'
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS'
  } else if (userAgent.includes('Linux')) {
    os = 'Linux'
  } else if (userAgent.includes('Android')) {
    os = 'Android'
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS'
  }

  return { browser, os }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) {
    return 'Just now'
  } else if (diffMins < 60) {
    return `${diffMins} min ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString()
  }
}

export function SessionsList({ sessions, userId, currentSeries }: SessionsListProps) {
  const router = useRouter()
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)
  const [error, setError] = useState('')

  const handleRevoke = async (series: string) => {
    setRevokingId(series)
    setError('')

    try {
      const response = await fetch(`/api/users/${userId}/sessions?series=${series}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error?.message || 'Failed to revoke session')
        return
      }

      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAll = async () => {
    setRevokingAll(true)
    setError('')

    try {
      const response = await fetch(`/api/users/${userId}/sessions?all=true`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error?.message || 'Failed to revoke sessions')
        return
      }

      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setRevokingAll(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
        <CardDescription>
          Devices where you&apos;re currently logged in with &quot;Remember me&quot;
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500">
            No active sessions. Sessions are created when you log in with &quot;Remember me&quot; enabled.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {sessions.map((session) => {
                const { browser, os } = parseUserAgent(session.userAgent)
                const isCurrentDevice = session.series === currentSeries

                return (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isCurrentDevice ? 'border-green-300 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">
                        {os === 'Windows' && '💻'}
                        {os === 'macOS' && '🖥️'}
                        {os === 'Linux' && '🐧'}
                        {os === 'Android' && '📱'}
                        {os === 'iOS' && '📱'}
                        {os === 'Unknown' && '🌐'}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {browser} on {os}
                          {isCurrentDevice && (
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                              This device
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {session.ipAddress || 'Unknown IP'} · Last active {formatDate(session.lastUsedAt)}
                        </div>
                      </div>
                    </div>
                    {!isCurrentDevice && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(session.series)}
                        disabled={revokingId === session.series}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {revokingId === session.series ? 'Revoking...' : 'Revoke'}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>

            {sessions.length > 1 && (
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleRevokeAll}
                  disabled={revokingAll}
                >
                  {revokingAll ? 'Revoking all...' : 'Revoke all other sessions'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
