'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface DeleteAccountProps {
  isAdmin: boolean
  isOrgOwner: boolean
  hasPassword: boolean
}

export function DeleteAccount({ isAdmin, isOrgOwner, hasPassword }: DeleteAccountProps) {
  const router = useRouter()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const canDelete = !isAdmin && !isOrgOwner && hasPassword

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/users/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          confirmation,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || 'Failed to delete account')
        return
      }

      // Redirect to home page after successful deletion
      router.push('/?deleted=true')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setShowConfirmation(false)
    setPassword('')
    setConfirmation('')
    setError('')
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Trash2 className="h-5 w-5" />
          Delete Account
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canDelete ? (
          <Alert variant="warning" className="mb-4">
            {isAdmin && 'System administrators cannot delete their own account. Contact another admin.'}
            {isOrgOwner && 'You must transfer organization ownership before deleting your account.'}
            {!hasPassword && 'OAuth-only accounts cannot be deleted this way. Please contact support.'}
          </Alert>
        ) : !showConfirmation ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-medium mb-1">This action is permanent and cannot be undone.</p>
                  <p>All your data will be permanently deleted, including:</p>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>Your profile and account information</li>
                    <li>All active sessions and devices</li>
                    <li>API keys and OAuth connections</li>
                    <li>Two-factor authentication settings</li>
                  </ul>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => setShowConfirmation(true)}
            >
              I understand, delete my account
            </Button>
          </div>
        ) : (
          <form onSubmit={handleDelete} className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Enter your password to confirm
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmation" className="text-sm font-medium text-gray-700">
                Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE MY ACCOUNT</span> to confirm
              </label>
              <Input
                id="confirmation"
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isLoading || confirmation !== 'DELETE MY ACCOUNT'}
              >
                {isLoading ? 'Deleting...' : 'Delete my account permanently'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
