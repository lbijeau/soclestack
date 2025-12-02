'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TwoFactorInput } from './two-factor-input'
import { OAuthButtons, OAuthDivider } from './oauth-buttons'
import { LoginInput } from '@/lib/validations'
import { AuthError } from '@/types/auth'
import type { OAuthProvider } from '@/lib/auth/oauth/providers'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl') || '/dashboard'

  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
    rememberMe: false,
  })
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [requires2FA, setRequires2FA] = useState(false)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [twoFactorError, setTwoFactorError] = useState('')
  const [enabledProviders, setEnabledProviders] = useState<OAuthProvider[]>([])

  useEffect(() => {
    // Fetch enabled OAuth providers
    fetch('/api/auth/oauth/accounts')
      .then(res => res.json())
      .then(data => setEnabledProviders(data.enabledProviders || []))
      .catch(() => {})

    // Check for OAuth error from URL
    const oauthError = searchParams.get('error')
    if (oauthError) {
      const errorMessages: Record<string, string> = {
        oauth_denied: 'OAuth authorization was denied',
        invalid_provider: 'Invalid OAuth provider',
        missing_params: 'OAuth callback missing required parameters',
        invalid_state: 'OAuth session expired. Please try again.',
        token_exchange_failed: 'Failed to complete OAuth authentication',
        profile_fetch_failed: 'Failed to fetch profile from OAuth provider',
        account_inactive: 'Your account is inactive. Please contact support.',
      }
      setError(errorMessages[oauthError] || 'OAuth authentication failed')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setErrors({})

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        const authError = data.error as AuthError
        if (authError.type === 'VALIDATION_ERROR' && authError.details) {
          setErrors(authError.details)
        } else if (authError.type === 'ACCOUNT_LOCKED') {
          setError(authError.message)
          setIsLocked(true)
        } else {
          setError(authError.message)
        }
        return
      }

      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        setRequires2FA(true)
        setPendingToken(data.pendingToken)
        return
      }

      // Store tokens (in a real app, you might want to use httpOnly cookies)
      if (data.tokens) {
        localStorage.setItem('accessToken', data.tokens.accessToken)
        localStorage.setItem('refreshToken', data.tokens.refreshToken)
      }

      // Redirect to return URL or dashboard
      router.push(returnUrl)
      router.refresh()

    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: [] }))
    }
  }

  const handle2FASubmit = async (code: string, isBackupCode: boolean) => {
    setIsLoading(true)
    setTwoFactorError('')

    try {
      const response = await fetch('/api/auth/2fa/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pendingToken,
          code,
          isBackupCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setTwoFactorError(data.error?.message || 'Invalid code')
        return
      }

      // Store tokens
      if (data.tokens) {
        localStorage.setItem('accessToken', data.tokens.accessToken)
        localStorage.setItem('refreshToken', data.tokens.refreshToken)
      }

      // Show warning if low on backup codes
      if (data.warnings?.lowBackupCodes) {
        alert(`Warning: You only have ${data.warnings.remainingBackupCodes} backup codes remaining. Consider regenerating them.`)
      }

      // Redirect
      router.push(returnUrl)
      router.refresh()

    } catch {
      setTwoFactorError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel2FA = () => {
    setRequires2FA(false)
    setPendingToken(null)
    setTwoFactorError('')
    setFormData({ email: '', password: '', rememberMe: false })
  }

  if (requires2FA) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Verify your identity to complete sign in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorInput
            onSubmit={handle2FASubmit}
            onCancel={handleCancel2FA}
            isLoading={isLoading}
            error={twoFactorError}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Enter your email and password to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
            {isLocked && (
              <div className="mt-2">
                <Link
                  href={`/request-unlock?email=${encodeURIComponent(formData.email)}`}
                  className="text-sm underline hover:no-underline"
                >
                  Request account unlock
                </Link>
              </div>
            )}
          </Alert>
        )}

        {enabledProviders.length > 0 && (
          <>
            <OAuthButtons
              enabledProviders={enabledProviders}
              returnTo={returnUrl}
              isLoading={isLoading}
              mode="login"
            />
            <OAuthDivider />
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              error={!!errors.email}
              disabled={isLoading}
              data-testid="email-input"
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              error={!!errors.password}
              disabled={isLoading}
              data-testid="password-input"
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password[0]}</p>
            )}
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              data-testid="remember-me-checkbox"
              checked={formData.rememberMe}
              onChange={(e) => setFormData(prev => ({ ...prev, rememberMe: e.target.checked }))}
              disabled={isLoading}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
              Remember me
            </label>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || isLocked}
            data-testid="login-submit"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>

          <div className="text-center space-y-2">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-500"
              data-testid="forgot-password-link"
            >
              Forgot your password?
            </Link>
            <div className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-500" data-testid="register-link">
                Sign up
              </Link>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}