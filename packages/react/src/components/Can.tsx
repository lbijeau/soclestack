import type { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';

export interface CanProps {
  /** Content to show when user has permission */
  children: ReactNode;
  /** Global roles to check (user must have at least one) */
  roles?: string[];
  /** Organization roles to check (user must have at least one) */
  orgRoles?: string[];
  /** Content to show when user lacks permission */
  fallback?: ReactNode;
}

/**
 * Conditionally render content based on user permissions
 *
 * @example
 * ```tsx
 * // Show only to admins
 * <Can roles={['ROLE_ADMIN']}>
 *   <DeleteButton />
 * </Can>
 *
 * // Show only to org owners/admins
 * <Can orgRoles={['ROLE_OWNER', 'ROLE_ADMIN']}>
 *   <InviteMemberButton />
 * </Can>
 *
 * // With fallback for unauthorized users
 * <Can roles={['ROLE_ADMIN']} fallback={<UpgradePrompt />}>
 *   <PremiumFeature />
 * </Can>
 * ```
 */
export function Can({
  children,
  roles,
  orgRoles,
  fallback = null,
}: CanProps) {
  const { can } = usePermissions();

  if (can({ roles, orgRoles })) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
