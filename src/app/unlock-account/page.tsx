'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Unlock, CheckCircle, XCircle, Loader2 } from 'lucide-react'

function UnlockAccountContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('no-token')
      return
    }

    verifyUnlock()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const verifyUnlock = async () => {
    try {
      const response = await fetch('/api/auth/verify-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setMessage(data.error?.message || 'Failed to unlock account')
        return
      }

      setStatus('success')
      setMessage(data.message)
    } catch {
      setStatus('error')
      setMessage('An unexpected error occurred')
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Unlocking your account...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'no-token') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <Unlock className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle className="text-center mt-4">Invalid Link</CardTitle>
            <CardDescription className="text-center">
              This unlock link appears to be invalid or incomplete.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/request-unlock">
              <Button className="w-full">Request New Unlock Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-center mt-4">Unlock Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="error" className="mb-4">
              {message}
            </Alert>
            <div className="space-y-3">
              <Link href="/request-unlock">
                <Button className="w-full">Request New Unlock Link</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full">Back to Login</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-center mt-4">Account Unlocked!</CardTitle>
          <CardDescription className="text-center">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button className="w-full">Sign In Now</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  )
}

export default function UnlockAccountPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <UnlockAccountContent />
    </Suspense>
  )
}
