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
import { parseUserAgent } from '@/lib/utils/user-agent';
import { CheckCircle, XCircle, LogOut, Shield, Loader2 } from 'lucide-react';

interface LoginEvent {
  id: string;
  action: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  reason?: string;
  createdAt: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getActionLabel(action: string): string {
  switch (action) {
    case 'AUTH_LOGIN_SUCCESS':
      return 'Login successful';
    case 'AUTH_LOGIN_FAILED':
      return 'Login failed';
    case 'AUTH_LOGOUT':
      return 'Logged out';
    case 'AUTH_2FA_SUCCESS':
      return '2FA verified';
    case 'AUTH_2FA_FAILED':
      return '2FA failed';
    default:
      return action;
  }
}

function getActionIcon(action: string, success: boolean) {
  if (action === 'AUTH_LOGOUT') {
    return <LogOut className="h-5 w-5 text-gray-500" />;
  }
  if (action.includes('2FA')) {
    return success ? (
      <Shield className="h-5 w-5 text-green-500" />
    ) : (
      <Shield className="h-5 w-5 text-red-500" />
    );
  }
  return success ? (
    <CheckCircle className="h-5 w-5 text-green-500" />
  ) : (
    <XCircle className="h-5 w-5 text-red-500" />
  );
}

export function LoginHistory() {
  const [history, setHistory] = useState<LoginEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/users/login-history?limit=20');
      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || 'Failed to load login history');
        return;
      }
      const data = await response.json();
      setHistory(data.history);
    } catch {
      setError('Failed to load login history');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="login-history-card">
        <CardHeader>
          <CardTitle>Login History</CardTitle>
          <CardDescription>
            Recent login activity on your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex justify-center py-8"
            data-testid="login-history-loading"
          >
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="login-history-card">
      <CardHeader>
        <CardTitle>Login History</CardTitle>
        <CardDescription>Recent login activity on your account</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert
            variant="error"
            className="mb-4"
            data-testid="login-history-error"
          >
            {error}
          </Alert>
        )}

        {history.length === 0 ? (
          <p
            className="text-sm text-gray-500"
            data-testid="login-history-empty"
          >
            No login history available.
          </p>
        ) : (
          <div className="space-y-3" data-testid="login-history-list">
            {history.map((event) => {
              const { browser, os } = parseUserAgent(event.userAgent);

              return (
                <div
                  key={event.id}
                  data-testid={`login-event-${event.id}`}
                  data-event-success={event.success}
                  className={`flex items-start gap-4 rounded-lg border p-4 ${
                    event.success
                      ? 'border-gray-200'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="mt-0.5">
                    {getActionIcon(event.action, event.success)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="font-medium text-gray-900"
                        data-testid="login-event-action"
                      >
                        {getActionLabel(event.action)}
                      </span>
                      <span
                        className="text-sm whitespace-nowrap text-gray-500"
                        data-testid="login-event-date"
                      >
                        {formatDate(event.createdAt)}
                      </span>
                    </div>
                    <div
                      className="mt-1 text-sm text-gray-500"
                      data-testid="login-event-device"
                    >
                      {browser} on {os} · {event.ipAddress || 'Unknown IP'}
                    </div>
                    {event.reason && (
                      <div
                        className="mt-1 text-sm text-red-600"
                        data-testid="login-event-reason"
                      >
                        Reason: {event.reason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
