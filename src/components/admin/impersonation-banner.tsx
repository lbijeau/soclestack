'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ImpersonationBannerProps {
  targetEmail: string
  timeRemainingMinutes: number
}

export function ImpersonationBanner({ targetEmail, timeRemainingMinutes: initialTime }: ImpersonationBannerProps) {
  const router = useRouter()
  const [timeRemaining, setTimeRemaining] = useState(initialTime)
  const [isExiting, setIsExiting] = useState(false)

  // Update timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time expired, refresh to trigger session restore
          router.refresh()
          return 0
        }
        return prev - 1
      })
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [router])

  const handleExit = async () => {
    setIsExiting(true)

    try {
      const response = await fetch('/api/admin/exit-impersonation', {
        method: 'POST',
      })

      if (response.ok) {
        router.refresh()
      } else {
        setIsExiting(false)
        console.error('Failed to exit impersonation')
      }
    } catch (error) {
      setIsExiting(false)
      console.error('Exit impersonation error:', error)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">
            Impersonating <strong>{targetEmail}</strong>
          </span>
          <span className="text-amber-800">
            - {timeRemaining} min remaining
          </span>
        </div>
        <button
          onClick={handleExit}
          disabled={isExiting}
          className="px-3 py-1 bg-amber-700 text-white rounded hover:bg-amber-800 disabled:opacity-50 text-sm font-medium"
        >
          {isExiting ? 'Exiting...' : 'Exit Impersonation'}
        </button>
      </div>
    </div>
  )
}
