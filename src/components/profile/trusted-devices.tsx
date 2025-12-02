'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Smartphone, Monitor, Loader2, Trash2, Shield, CheckCircle } from 'lucide-react'

interface Device {
  id: string
  series: string
  browser: string
  os: string
  ipAddress: string
  lastUsedAt: string
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

function getDeviceIcon(os: string) {
  const lower = os.toLowerCase()
  if (lower.includes('android') || lower.includes('ios')) {
    return Smartphone
  }
  return Monitor
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function TrustedDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    fetchDevices()
  }, [])

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/users/devices')
      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || 'Failed to fetch devices')
        return
      }

      setDevices(data.devices)
    } catch {
      setError('Failed to fetch devices')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevoke = async (deviceId: string) => {
    setRevokingId(deviceId)
    setError('')
    setSuccessMessage('')

    try {
      const response = await fetch(`/api/users/devices/${deviceId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || 'Failed to revoke device')
        return
      }

      setDevices(devices.filter((d) => d.id !== deviceId))
      setSuccessMessage('Device revoked successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch {
      setError('Failed to revoke device')
    } finally {
      setRevokingId(null)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <CardTitle>Trusted Devices</CardTitle>
        </div>
        <CardDescription>
          Devices that have been remembered for quick sign-in. Revoking a device will require
          full authentication on next login.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" className="mb-4">
            <CheckCircle className="h-4 w-4 mr-2 inline" />
            {successMessage}
          </Alert>
        )}

        {devices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Monitor className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No trusted devices found</p>
            <p className="text-sm mt-1">
              Devices appear here when you select &quot;Remember me&quot; during login
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {devices.map((device) => {
              const DeviceIcon = getDeviceIcon(device.os)
              return (
                <div
                  key={device.id}
                  className={`flex items-start justify-between p-4 border rounded-lg ${
                    device.isCurrent ? 'border-blue-200 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        device.isCurrent ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                    >
                      <DeviceIcon
                        className={`h-6 w-6 ${
                          device.isCurrent ? 'text-blue-600' : 'text-gray-600'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">
                          {device.browser} on {device.os}
                        </h4>
                        {device.isCurrent && (
                          <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {device.ipAddress} · Last used {formatDate(device.lastUsedAt)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Added {formatDate(device.createdAt)}
                      </p>
                    </div>
                  </div>

                  {!device.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(device.id)}
                      disabled={revokingId === device.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {revokingId === device.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {devices.length > 0 && (
          <p className="text-xs text-gray-500 mt-4">
            Trusted devices have &quot;Remember Me&quot; enabled and don&apos;t require password
            entry for a period of time. If you don&apos;t recognize a device, revoke it immediately
            and change your password.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
