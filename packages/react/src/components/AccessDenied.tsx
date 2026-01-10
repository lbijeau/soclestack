import type { ReactNode, CSSProperties } from 'react';

export interface AccessDeniedProps {
  /** Title text */
  title?: string;
  /** Description text */
  message?: string;
  /** Custom content to render instead of default */
  children?: ReactNode;
  /** Additional class name */
  className?: string;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  textAlign: 'center',
};

const titleStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#dc2626',
  marginBottom: '0.5rem',
};

const messageStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: '#6b7280',
};

/**
 * Access denied component shown when user lacks required permissions
 */
export function AccessDenied({
  title = 'Access Denied',
  message = "You don't have permission to view this content.",
  children,
  className,
}: AccessDeniedProps) {
  if (children) {
    return <>{children}</>;
  }

  return (
    <div style={containerStyle} className={className} role="alert">
      <div style={titleStyle}>{title}</div>
      <div style={messageStyle}>{message}</div>
    </div>
  );
}
