import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../hooks';

export interface AuthGuardProps {
  /** Content to show when authenticated */
  children: ReactNode;
  /** Content to show when not authenticated */
  fallback?: ReactNode;
  /** Content to show while checking auth status */
  loadingFallback?: ReactNode;
  /** Called when user is not authenticated (for redirects) */
  onUnauthenticated?: () => void;
}

export function AuthGuard({
  children,
  fallback = null,
  loadingFallback = null,
  onUnauthenticated,
}: AuthGuardProps) {
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'unauthenticated' && onUnauthenticated) {
      onUnauthenticated();
    }
  }, [state.status, onUnauthenticated]);

  if (state.status === 'loading') {
    return <>{loadingFallback}</>;
  }

  if (state.status !== 'authenticated') {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
