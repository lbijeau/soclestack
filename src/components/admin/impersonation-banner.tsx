'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserX, Clock } from 'lucide-react';
import { apiPost } from '@/lib/api-client';

interface ImpersonationBannerProps {
  originalEmail: string;
  targetEmail: string;
  minutesRemaining: number;
}

export function ImpersonationBanner({
  originalEmail,
  targetEmail,
  minutesRemaining,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  const handleExit = async () => {
    setIsExiting(true);
    try {
      const response = await apiPost('/api/admin/exit-impersonation');

      if (response.ok) {
        router.push('/admin');
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to exit impersonation:', error);
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <div className="bg-amber-500 text-amber-950" data-testid="impersonation-banner">
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <UserX className="h-5 w-5" />
            <span className="font-medium" data-testid="impersonation-banner-target">
              Impersonating {targetEmail}
            </span>
            <span
              className="text-sm text-amber-800"
              data-testid="impersonation-banner-original"
            >
              (logged in as {originalEmail})
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-1 text-sm text-amber-800"
              data-testid="impersonation-banner-timer"
            >
              <Clock className="h-4 w-4" />
              <span>{minutesRemaining}m remaining</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleExit}
              disabled={isExiting}
              className="border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"
              data-testid="impersonation-banner-exit-button"
            >
              {isExiting ? 'Exiting...' : 'Exit Impersonation'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
