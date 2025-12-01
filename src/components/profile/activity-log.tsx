'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import {
  Loader2,
  Activity,
  LogIn,
  LogOut,
  Key,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Globe,
} from 'lucide-react'
import { parseUserAgent } from '@/lib/utils/user-agent'

interface ActivityLog {
  id: string
  action: string
  category: string
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface ActivityResponse {
  logs: ActivityLog[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Map actions to user-friendly labels and icons
const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'success' | 'warning' | 'error' | 'info' }> = {
  // Authentication
  AUTH_LOGIN_SUCCESS: { label: 'Signed in', icon: <LogIn className="h-4 w-4" />, variant: 'success' },
  AUTH_LOGIN_FAILURE: { label: 'Failed sign in attempt', icon: <LogIn className="h-4 w-4" />, variant: 'error' },
  AUTH_LOGOUT: { label: 'Signed out', icon: <LogOut className="h-4 w-4" />, variant: 'info' },
  AUTH_REMEMBER_ME_CREATED: { label: 'Remember me enabled', icon: <Monitor className="h-4 w-4" />, variant: 'info' },
  AUTH_REMEMBER_ME_USED: { label: 'Signed in with remembered device', icon: <Monitor className="h-4 w-4" />, variant: 'success' },
  AUTH_REMEMBER_ME_THEFT_DETECTED: { label: 'Suspicious session activity detected', icon: <AlertTriangle className="h-4 w-4" />, variant: 'error' },
  // Security
  SECURITY_ACCOUNT_LOCKED: { label: 'Account locked', icon: <ShieldAlert className="h-4 w-4" />, variant: 'warning' },
  SECURITY_ACCOUNT_UNLOCKED: { label: 'Account unlocked', icon: <ShieldCheck className="h-4 w-4" />, variant: 'success' },
  SECURITY_PASSWORD_CHANGED: { label: 'Password changed', icon: <Key className="h-4 w-4" />, variant: 'info' },
  SECURITY_ALL_SESSIONS_REVOKED: { label: 'All sessions revoked', icon: <ShieldOff className="h-4 w-4" />, variant: 'warning' },
  // Two-factor
  AUTH_2FA_ENABLED: { label: 'Two-factor authentication enabled', icon: <Smartphone className="h-4 w-4" />, variant: 'success' },
  AUTH_2FA_DISABLED: { label: 'Two-factor authentication disabled', icon: <Smartphone className="h-4 w-4" />, variant: 'warning' },
  AUTH_2FA_SUCCESS: { label: 'Two-factor verification successful', icon: <ShieldCheck className="h-4 w-4" />, variant: 'success' },
  AUTH_2FA_FAILURE: { label: 'Two-factor verification failed', icon: <ShieldAlert className="h-4 w-4" />, variant: 'error' },
  AUTH_2FA_BACKUP_USED: { label: 'Backup code used', icon: <Key className="h-4 w-4" />, variant: 'warning' },
  ADMIN_2FA_RESET: { label: 'Two-factor reset by admin', icon: <Shield className="h-4 w-4" />, variant: 'warning' },
  // OAuth
  AUTH_OAUTH_LOGIN_SUCCESS: { label: 'Signed in with OAuth', icon: <Globe className="h-4 w-4" />, variant: 'success' },
  AUTH_OAUTH_LOGIN_FAILURE: { label: 'OAuth sign in failed', icon: <Globe className="h-4 w-4" />, variant: 'error' },
  AUTH_OAUTH_REGISTRATION: { label: 'Registered with OAuth', icon: <Globe className="h-4 w-4" />, variant: 'success' },
  AUTH_OAUTH_ACCOUNT_LINKED: { label: 'OAuth account linked', icon: <Globe className="h-4 w-4" />, variant: 'success' },
  AUTH_OAUTH_ACCOUNT_UNLINKED: { label: 'OAuth account unlinked', icon: <Globe className="h-4 w-4" />, variant: 'info' },
  // API Keys
  API_KEY_CREATED: { label: 'API key created', icon: <Key className="h-4 w-4" />, variant: 'info' },
  API_KEY_UPDATED: { label: 'API key updated', icon: <Key className="h-4 w-4" />, variant: 'info' },
  API_KEY_REVOKED: { label: 'API key revoked', icon: <Key className="h-4 w-4" />, variant: 'warning' },
}

const VARIANT_STYLES = {
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
}

export function ActivityLog() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = async (page: number) => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/users/activity?page=${page}&limit=20`)
      if (!res.ok) throw new Error('Failed to fetch activity')

      const data: ActivityResponse = await res.json()
      setLogs(data.logs)
      setPagination(data.pagination)
    } catch {
      setError('Failed to load activity log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(1)
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        if (minutes < 1) return 'Just now'
        return `${minutes}m ago`
      }
      return `${hours}h ago`
    }
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getDeviceInfo = (userAgent: string | null) => {
    if (!userAgent) return null
    const parsed = parseUserAgent(userAgent)
    return `${parsed.browser} on ${parsed.os}`
  }

  const getActionDetails = (log: ActivityLog) => {
    const details: string[] = []

    if (log.metadata) {
      // OAuth provider
      if (log.metadata.provider) {
        details.push(`via ${String(log.metadata.provider).charAt(0).toUpperCase() + String(log.metadata.provider).slice(1)}`)
      }
      // API key name
      if (log.metadata.keyName) {
        details.push(`"${log.metadata.keyName}"`)
      }
      // Backup codes remaining
      if (log.metadata.remainingBackupCodes !== undefined) {
        details.push(`${log.metadata.remainingBackupCodes} codes remaining`)
      }
    }

    return details.join(' - ')
  }

  if (loading && logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Recent security events on your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No activity yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {logs.map((log) => {
                const config = ACTION_CONFIG[log.action] || {
                  label: log.action,
                  icon: <Activity className="h-4 w-4" />,
                  variant: 'info' as const,
                }
                const details = getActionDetails(log)
                const deviceInfo = getDeviceInfo(log.userAgent)

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${VARIANT_STYLES[config.variant]}`}
                  >
                    <div className="mt-0.5">{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{config.label}</span>
                        {details && (
                          <span className="text-sm opacity-75">{details}</span>
                        )}
                      </div>
                      <div className="text-sm opacity-75 mt-0.5">
                        {formatDate(log.createdAt)} at {formatTime(log.createdAt)}
                        {deviceInfo && <> &middot; {deviceInfo}</>}
                        {log.ipAddress && <> &middot; {log.ipAddress}</>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <span className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLogs(pagination.page - 1)}
                    disabled={pagination.page <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLogs(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
