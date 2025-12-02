'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, X, RefreshCw } from 'lucide-react'

interface SessionStatus {
  isValid: boolean
  expiresAt: number | null
  timeRemainingMs: number | null
  shouldWarn: boolean
}

const CHECK_INTERVAL_MS = 60 * 1000 // Check every minute
const WARNING_UPDATE_INTERVAL_MS = 1000 // Update countdown every second when warning

function formatTimeRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export function SessionTimeoutWarning() {
  const router = useRouter()
  const [status, setStatus] = useState<SessionStatus | null>(null)
  const [isExtending, setIsExtending] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [displayTime, setDisplayTime] = useState<string>('')

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session-status')
      if (response.ok) {
        const data: SessionStatus = await response.json()
        setStatus(data)

        // Reset dismissed state if session was extended or warning threshold changed
        if (!data.shouldWarn) {
          setIsDismissed(false)
        }

        // If session expired, redirect to login
        if (!data.isValid && data.expiresAt !== null) {
          router.push('/login?expired=true')
        }
      }
    } catch (error) {
      console.error('Failed to check session status:', error)
    }
  }, [router])

  const handleExtend = async () => {
    setIsExtending(true)
    try {
      const response = await fetch('/api/auth/extend-session', {
        method: 'POST',
      })

      if (response.ok) {
        setIsDismissed(false)
        await checkSession()
      } else {
        // Session couldn't be extended, likely expired
        router.push('/login?expired=true')
      }
    } catch (error) {
      console.error('Failed to extend session:', error)
    } finally {
      setIsExtending(false)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
  }

  // Check session status periodically
  useEffect(() => {
    checkSession()
    const interval = setInterval(checkSession, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [checkSession])

  // Update display time when warning is shown
  useEffect(() => {
    if (!status?.shouldWarn || isDismissed) return

    const updateDisplayTime = () => {
      if (status.timeRemainingMs !== null) {
        const remaining = status.expiresAt! - Date.now()
        if (remaining > 0) {
          setDisplayTime(formatTimeRemaining(remaining))
        } else {
          router.push('/login?expired=true')
        }
      }
    }

    updateDisplayTime()
    const interval = setInterval(updateDisplayTime, WARNING_UPDATE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status, isDismissed, router])

  // Don't render if no warning needed or dismissed
  if (!status?.shouldWarn || isDismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
      <Card className="w-80 shadow-lg border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-orange-900">Session Expiring Soon</h4>
              <p className="text-sm text-orange-700 mt-1">
                Your session will expire in{' '}
                <span className="font-mono font-semibold">{displayTime}</span>
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleExtend}
                  disabled={isExtending}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isExtending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Extend Session
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  className="text-orange-700 hover:text-orange-900 hover:bg-orange-100"
                >
                  Dismiss
                </Button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-orange-400 hover:text-orange-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
