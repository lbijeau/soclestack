import { useAuth, useOrganization } from '../hooks';

export interface CanOptions {
  /** Global user roles to check */
  roles?: string[];
  /** Organization-specific roles to check */
  orgRoles?: string[];
}

/**
 * Hook for checking user permissions
 *
 * @example
 * ```tsx
 * const { can } = usePermissions();
 *
 * if (can({ roles: ['ROLE_ADMIN'] })) {
 *   // User has admin role
 * }
 *
 * if (can({ orgRoles: ['ROLE_OWNER', 'ROLE_ADMIN'] })) {
 *   // User is owner or admin of current org
 * }
 * ```
 */
export function usePermissions() {
  const { state } = useAuth();
  const organization = useOrganization();

  const user = state.status === 'authenticated' ? state.user : null;

  const can = ({ roles, orgRoles }: CanOptions): boolean => {
    if (!user) return false;

    // Check global roles
    if (roles && roles.length > 0) {
      const userRoles = user.roles || [];
      if (!roles.some((r) => userRoles.includes(r))) {
        return false;
      }
    }

    // Check org roles
    if (orgRoles && orgRoles.length > 0) {
      const userOrgRole = organization?.role;
      if (!userOrgRole || !orgRoles.includes(userOrgRole)) {
        return false;
      }
    }

    return true;
  };

  return { can, user, organization };
}
