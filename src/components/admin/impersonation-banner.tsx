'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserX, Clock } from 'lucide-react'

interface ImpersonationBannerProps {
  originalEmail: string
  targetEmail: string
  minutesRemaining: number
}

export function ImpersonationBanner({
  originalEmail,
  targetEmail,
  minutesRemaining,
}: ImpersonationBannerProps) {
  const router = useRouter()
  const [isExiting, setIsExiting] = useState(false)

  const handleExit = async () => {
    setIsExiting(true)
    try {
      const response = await fetch('/api/admin/exit-impersonation', {
        method: 'POST',
      })

      if (response.ok) {
        router.push('/admin')
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to exit impersonation:', error)
    } finally {
      setIsExiting(false)
    }
  }

  return (
    <div className="bg-amber-500 text-amber-950">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <UserX className="h-5 w-5" />
            <span className="font-medium">
              Impersonating {targetEmail}
            </span>
            <span className="text-amber-800 text-sm">
              (logged in as {originalEmail})
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm text-amber-800">
              <Clock className="h-4 w-4" />
              <span>{minutesRemaining}m remaining</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleExit}
              disabled={isExiting}
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
            >
              {isExiting ? 'Exiting...' : 'Exit Impersonation'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
