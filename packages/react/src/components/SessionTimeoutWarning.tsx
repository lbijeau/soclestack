import { type CSSProperties } from 'react';
import {
  useSessionTimeout,
  type UseSessionTimeoutOptions,
} from '../hooks/useSessionTimeout';

export interface SessionTimeoutWarningProps extends UseSessionTimeoutOptions {
  /** Modal title */
  title?: string;
  /** Modal message */
  message?: string;
  /** Extend button text */
  extendLabel?: string;
  /** Logout button text */
  logoutLabel?: string;
  /** Called after successful extend */
  onExtend?: () => void;
  /** Called when user clicks logout */
  onLogout?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * Modal component that warns users before session expires
 *
 * @example
 * ```tsx
 * // Basic usage - shows warning 5 min before expiry
 * <SessionTimeoutWarning />
 *
 * // With custom timing and callbacks
 * <SessionTimeoutWarning
 *   warnBefore={300}
 *   onTimeout={() => router.push('/login?expired=true')}
 *   onExtend={() => toast.success('Session extended')}
 *   onLogout={() => logout()}
 * />
 * ```
 */
export function SessionTimeoutWarning({
  warnBefore = 300,
  checkInterval = 30,
  sessionDuration,
  onWarning,
  onTimeout,
  onExtend,
  onLogout,
  title = 'Session Expiring',
  message = 'Your session is about to expire. Would you like to stay signed in?',
  extendLabel = 'Stay Signed In',
  logoutLabel = 'Log Out',
  className,
}: SessionTimeoutWarningProps) {
  const { timeRemaining, isWarning, extend, isExtending } = useSessionTimeout({
    warnBefore,
    checkInterval,
    sessionDuration,
    onWarning,
    onTimeout,
  });

  const handleExtend = async () => {
    const success = await extend();
    if (success) {
      onExtend?.();
    }
  };

  if (!isWarning || timeRemaining === null) {
    return null;
  }

  return (
    <div className={className} style={overlayStyles} role="alertdialog" aria-modal="true" aria-labelledby="session-timeout-title">
      <div style={modalStyles}>
        <ClockIcon />
        <h2 id="session-timeout-title" style={titleStyles}>{title}</h2>
        <p style={messageStyles}>{message}</p>
        <Countdown seconds={timeRemaining} />
        <div style={buttonContainerStyles}>
          <button
            type="button"
            onClick={handleExtend}
            disabled={isExtending}
            style={{
              ...primaryButtonStyles,
              opacity: isExtending ? 0.7 : 1,
            }}
          >
            {isExtending ? 'Extending...' : extendLabel}
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={secondaryButtonStyles}
            >
              {logoutLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components

function Countdown({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div style={countdownStyles}>
      <span style={countdownNumberStyles}>{display}</span>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginBottom: 16, color: '#f59e0b' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 6v6l4 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Styles

const overlayStyles: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalStyles: CSSProperties = {
  backgroundColor: 'white',
  borderRadius: 12,
  padding: 32,
  maxWidth: 400,
  width: '90%',
  textAlign: 'center',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

const titleStyles: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 20,
  fontWeight: 600,
  color: '#111827',
};

const messageStyles: CSSProperties = {
  margin: '0 0 16px',
  fontSize: 14,
  color: '#6b7280',
};

const countdownStyles: CSSProperties = {
  marginBottom: 24,
};

const countdownNumberStyles: CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  fontFamily: 'ui-monospace, monospace',
  color: '#ef4444',
};

const buttonContainerStyles: CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'center',
};

const primaryButtonStyles: CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#6366f1',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

const secondaryButtonStyles: CSSProperties = {
  padding: '10px 20px',
  backgroundColor: 'transparent',
  color: '#6b7280',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 14,
  cursor: 'pointer',
};
