/**
 * Canonical Permission Registry
 *
 * All voter permission attributes in one place for:
 * - Compile-time typo protection
 * - Discoverability
 * - Type safety
 */

export const PERMISSIONS = {
  ORGANIZATION: {
    VIEW: 'organization.view',
    EDIT: 'organization.edit',
    MANAGE: 'organization.manage',
    DELETE: 'organization.delete',
    MEMBERS: {
      VIEW: 'organization.members.view',
      MANAGE: 'organization.members.manage',
    },
    INVITES: {
      MANAGE: 'organization.invites.manage',
    },
  },
  USER: {
    VIEW: 'user.view',
    EDIT: 'user.edit',
    DELETE: 'user.delete',
    ROLES: {
      MANAGE: 'user.roles.manage',
    },
  },
} as const;

/**
 * Helper to extract all permission string values from nested object
 */
type ExtractPermissions<T> = T extends string
  ? T
  : T extends object
    ? { [K in keyof T]: ExtractPermissions<T[K]> }[keyof T]
    : never;

/**
 * Union type of all valid permission strings
 */
export type Permission = ExtractPermissions<typeof PERMISSIONS>;

/**
 * Flat arrays for voter attribute checking
 *
 * Why both PERMISSIONS object and flat arrays?
 * - PERMISSIONS object: Provides namespaced access for callers (PERMISSIONS.USER.VIEW)
 * - Flat arrays: Required for Array.includes() checks in voter supports() methods
 *   TypeScript's .includes() needs a readonly tuple, not nested object values
 */
export const ORGANIZATION_PERMISSIONS = [
  PERMISSIONS.ORGANIZATION.VIEW,
  PERMISSIONS.ORGANIZATION.EDIT,
  PERMISSIONS.ORGANIZATION.MANAGE,
  PERMISSIONS.ORGANIZATION.DELETE,
  PERMISSIONS.ORGANIZATION.MEMBERS.VIEW,
  PERMISSIONS.ORGANIZATION.MEMBERS.MANAGE,
  PERMISSIONS.ORGANIZATION.INVITES.MANAGE,
] as const;

export const USER_PERMISSIONS = [
  PERMISSIONS.USER.VIEW,
  PERMISSIONS.USER.EDIT,
  PERMISSIONS.USER.DELETE,
  PERMISSIONS.USER.ROLES.MANAGE,
] as const;

/**
 * All permissions combined for iteration
 */
export const ALL_PERMISSIONS = [
  ...ORGANIZATION_PERMISSIONS,
  ...USER_PERMISSIONS,
] as const;

export type OrganizationPermission = (typeof ORGANIZATION_PERMISSIONS)[number];
export type UserPermission = (typeof USER_PERMISSIONS)[number];

/**
 * Type guard to check if a string is a valid OrganizationPermission
 */
export function isOrganizationPermission(
  attr: string
): attr is OrganizationPermission {
  return (ORGANIZATION_PERMISSIONS as readonly string[]).includes(attr);
}

/**
 * Type guard to check if a string is a valid UserPermission
 */
export function isUserPermission(attr: string): attr is UserPermission {
  return (USER_PERMISSIONS as readonly string[]).includes(attr);
}

/**
 * Type guard to check if a string is any valid Permission
 */
export function isPermission(attr: string): attr is Permission {
  return isOrganizationPermission(attr) || isUserPermission(attr);
}
