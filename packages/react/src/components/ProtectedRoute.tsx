import type { ReactNode } from 'react';
import { useAuth } from '../hooks';
import { usePermissions } from '../hooks/usePermissions';
import { LoadingSpinner } from './LoadingSpinner';
import { AccessDenied } from './AccessDenied';

export interface ProtectedRouteProps {
  /** Content to show when authenticated and authorized */
  children: ReactNode;
  /** Global roles required (user must have at least one) */
  roles?: string[];
  /** Organization roles required (user must have at least one) */
  orgRoles?: string[];
  /** Content to show while checking auth status */
  loadingFallback?: ReactNode;
  /** Content to show when access is denied due to missing roles */
  accessDeniedFallback?: ReactNode;
  /** Called when user is not authenticated (for redirects) */
  onUnauthenticated?: () => void;
}

/**
 * Protect routes from unauthenticated users with optional role checks
 *
 * @example
 * ```tsx
 * // Basic protection
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 *
 * // With role requirements
 * <ProtectedRoute roles={['ROLE_ADMIN']}>
 *   <AdminPanel />
 * </ProtectedRoute>
 *
 * // With org role requirements
 * <ProtectedRoute orgRoles={['ROLE_OWNER', 'ROLE_ADMIN']}>
 *   <TeamSettings />
 * </ProtectedRoute>
 *
 * // With redirect
 * const router = useRouter();
 * <ProtectedRoute onUnauthenticated={() => router.push('/login')}>
 *   <Dashboard />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
  children,
  roles,
  orgRoles,
  loadingFallback = <LoadingSpinner />,
  accessDeniedFallback = <AccessDenied />,
  onUnauthenticated,
}: ProtectedRouteProps) {
  const { state } = useAuth();
  const { can } = usePermissions();

  // Loading state
  if (state.status === 'loading') {
    return <>{loadingFallback}</>;
  }

  // Not authenticated
  if (state.status !== 'authenticated') {
    if (onUnauthenticated) {
      onUnauthenticated();
    }
    return null;
  }

  // Check roles if specified
  const needsRoleCheck = (roles && roles.length > 0) || (orgRoles && orgRoles.length > 0);
  if (needsRoleCheck && !can({ roles, orgRoles })) {
    return <>{accessDeniedFallback}</>;
  }

  return <>{children}</>;
}
