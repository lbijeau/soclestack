'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Loader2, Bell, Monitor, Lock, Shield } from 'lucide-react';
import { apiPatch } from '@/lib/api-client';

interface Preferences {
  notifyNewDevice: boolean;
  notifyPasswordChange: boolean;
  notifyLoginAlert: boolean;
  notify2FAChange: boolean;
}

interface NotificationOption {
  key: keyof Preferences;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const notificationOptions: NotificationOption[] = [
  {
    key: 'notifyNewDevice',
    label: 'New device login',
    description:
      'Get notified when your account is accessed from a new device or browser',
    icon: <Monitor className="h-5 w-5 text-blue-600" />,
  },
  {
    key: 'notifyPasswordChange',
    label: 'Password changes',
    description: 'Get notified when your password is changed',
    icon: <Lock className="h-5 w-5 text-green-600" />,
  },
  {
    key: 'notifyLoginAlert',
    label: 'Account lockout alerts',
    description:
      'Get notified when your account is locked due to failed login attempts',
    icon: <Bell className="h-5 w-5 text-orange-600" />,
  },
  {
    key: 'notify2FAChange',
    label: 'Two-factor authentication changes',
    description: 'Get notified when 2FA is enabled or disabled on your account',
    icon: <Shield className="h-5 w-5 text-purple-600" />,
  },
];

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<keyof Preferences | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/users/notifications');
      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || 'Failed to load preferences');
        return;
      }
      const data = await response.json();
      setPreferences(data.preferences);
    } catch {
      setError('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof Preferences) => {
    if (!preferences) return;

    setIsSaving(key);
    setError('');
    setSuccess('');

    const newValue = !preferences[key];

    try {
      const response = await apiPatch('/api/users/notifications', { [key]: newValue });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || 'Failed to update preference');
        return;
      }

      setPreferences({ ...preferences, [key]: newValue });
      setSuccess('Preference updated');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Failed to update preference');
    } finally {
      setIsSaving(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Choose which security notifications you receive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>
          Choose which security notifications you receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <div className="space-y-4">
          {notificationOptions.map((option) => (
            <div
              key={option.key}
              className="flex items-start justify-between gap-4 rounded-lg border p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{option.icon}</div>
                <div>
                  <p className="font-medium text-gray-900">{option.label}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences?.[option.key] ?? true}
                onClick={() => handleToggle(option.key)}
                disabled={isSaving === option.key}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 ${
                  preferences?.[option.key] ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    preferences?.[option.key]
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <p className="pt-4 text-sm text-gray-500">
          These notifications help keep your account secure. We recommend
          keeping them enabled.
        </p>
      </CardContent>
    </Card>
  );
}
