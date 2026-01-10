'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Mail, X } from 'lucide-react';
import { apiPost } from '@/lib/api-client';

interface EmailVerificationBannerProps {
  email: string;
}

export function EmailVerificationBanner({
  email,
}: EmailVerificationBannerProps) {
  const [isResending, setIsResending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleResend = async () => {
    setIsResending(true);
    setMessage(null);

    try {
      const response = await apiPost('/api/auth/resend-verification');

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Verification email sent! Check your inbox.',
        });
      } else {
        setMessage({
          type: 'error',
          text: data.error?.message || 'Failed to send verification email',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send verification email' });
    } finally {
      setIsResending(false);
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Alert
      variant="warning"
      className="mb-6"
      data-testid="email-verification-banner"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium" data-testid="verification-banner-title">
              Verify your email address
            </p>
            <p
              className="mt-1 text-sm"
              data-testid="verification-banner-description"
            >
              We sent a verification email to <strong>{email}</strong>. Please
              check your inbox and click the link to verify your account.
            </p>
            {message && (
              <p
                className={`mt-2 text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}
                data-testid={
                  message.type === 'success'
                    ? 'verification-resend-success'
                    : 'verification-resend-error'
                }
              >
                {message.text}
              </p>
            )}
            <button
              className="mt-2 text-sm text-amber-800 underline hover:text-amber-900 disabled:opacity-50"
              onClick={handleResend}
              disabled={isResending}
              data-testid="resend-verification-button"
            >
              {isResending ? 'Sending...' : "Didn't receive the email? Resend"}
            </button>
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 text-amber-600 hover:text-amber-800"
          aria-label="Dismiss"
          data-testid="dismiss-verification-banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Alert>
  );
}
