'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'

interface TwoFactorSetupProps {
  onComplete: () => void
  onCancel: () => void
}

type Step = 'loading' | 'display' | 'verify'

interface SetupData {
  qrCodeDataUrl: string
  manualEntryKey: string
  backupCodes: string[]
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<Step>('loading')
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  const startSetup = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || 'Failed to start 2FA setup')
        return
      }

      setSetupData(data)
      setStep('display')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const verifySetup = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || 'Invalid code')
        return
      }

      onComplete()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const copyBackupCodes = () => {
    if (setupData) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'))
      setCopiedCodes(true)
    }
  }

  const downloadBackupCodes = () => {
    if (setupData) {
      const content = `SocleStack Backup Codes\n${'='.repeat(20)}\n\n${setupData.backupCodes.join('\n')}\n\nKeep these codes safe. Each code can only be used once.`
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'soclestack-backup-codes.txt'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // Start setup automatically on mount
  useEffect(() => {
    if (step === 'loading' && !setupData) {
      startSetup()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial loading state
  if (step === 'loading') {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p>Setting up two-factor authentication...</p>
        </CardContent>
      </Card>
    )
  }

  if (step === 'display' && setupData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="space-y-4">
            <h3 className="font-medium">1. Scan QR Code</h3>
            <p className="text-sm text-gray-600">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setupData.qrCodeDataUrl}
                alt="2FA QR Code"
                className="border rounded-lg"
              />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-blue-600">Can&apos;t scan? Enter manually</summary>
              <code className="block mt-2 p-2 bg-gray-100 rounded break-all">
                {setupData.manualEntryKey}
              </code>
            </details>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium">2. Save Backup Codes</h3>
            <Alert variant="warning">
              Save these backup codes in a safe place. You won&apos;t be able to see them again!
            </Alert>
            <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-lg font-mono text-sm">
              {setupData.backupCodes.map((code, i) => (
                <div key={i}>{code}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={copyBackupCodes}>
                {copiedCodes ? 'Copied!' : 'Copy codes'}
              </Button>
              <Button variant="secondary" onClick={downloadBackupCodes}>
                Download codes
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => setStep('verify')}>
              I&apos;ve saved my backup codes
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'verify') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <p className="text-sm text-gray-600">
            Enter a code from your authenticator app to complete setup.
          </p>

          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            className="w-full px-3 py-2 border rounded text-center text-2xl tracking-widest"
            autoFocus
          />

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep('display')}>
              Back
            </Button>
            <Button
              onClick={verifySetup}
              disabled={isLoading || verifyCode.length !== 6}
            >
              {isLoading ? 'Verifying...' : 'Enable 2FA'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
