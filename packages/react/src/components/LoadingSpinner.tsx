import type { CSSProperties } from 'react';

export interface LoadingSpinnerProps {
  /** Size of the spinner in pixels */
  size?: number;
  /** Color of the spinner */
  color?: string;
  /** Additional class name */
  className?: string;
}

const spinnerStyle: CSSProperties = {
  display: 'inline-block',
  borderRadius: '50%',
  borderStyle: 'solid',
  borderTopColor: 'transparent',
  animation: 'socle-spin 0.8s linear infinite',
};

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
};

/**
 * Simple loading spinner component
 */
export function LoadingSpinner({
  size = 24,
  color = '#6366f1',
  className,
}: LoadingSpinnerProps) {
  return (
    <div style={containerStyle} className={className}>
      <style>{`
        @keyframes socle-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        role="status"
        aria-label="Loading"
        style={{
          ...spinnerStyle,
          width: size,
          height: size,
          borderWidth: Math.max(2, size / 8),
          borderColor: color,
          borderTopColor: 'transparent',
        }}
      />
    </div>
  );
}
