'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Shield,
  LogIn,
  LogOut,
  Key,
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  Lock,
  Unlock,
  Smartphone,
  Link as LinkIcon,
  Unlink,
  KeyRound,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Info,
} from 'lucide-react';

interface SecurityEvent {
  id: string;
  action: string;
  description: string;
  icon: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  ipAddress: string | null;
  createdAt: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  login: LogIn,
  logout: LogOut,
  key: Key,
  'shield-check': ShieldCheck,
  'shield-off': ShieldOff,
  'shield-alert': ShieldAlert,
  lock: Lock,
  unlock: Unlock,
  device: Smartphone,
  link: LinkIcon,
  unlink: Unlink,
  'key-plus': KeyRound,
  'key-minus': KeyRound,
  backup: Key,
  alert: AlertTriangle,
  info: Info,
};

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-600',
  success: 'bg-green-100 text-green-600',
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-red-100 text-red-600',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SecurityEventsWidget() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/users/security-events');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to fetch events');
        return;
      }

      setEvents(data.events);
    } catch {
      setError('Failed to fetch security events');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Recent Security Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Recent Security Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Recent Security Activity
          </CardTitle>
          <Link
            href="/profile/activity"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            View all
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">
            No recent security events
          </p>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => {
              const IconComponent = iconMap[event.icon] || Info;
              return (
                <div key={event.id} className="flex items-start gap-3 text-sm">
                  <div
                    className={`rounded-full p-1.5 ${severityColors[event.severity]}`}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {event.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTimeAgo(event.createdAt)}
                      {event.ipAddress && (
                        <span className="ml-2">· {event.ipAddress}</span>
                      )}
                    </p>
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
