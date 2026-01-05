/**
 * Shared role name constants
 * Use these constants across frontend and backend to avoid typos and drift
 */

export const ROLE_NAMES = {
  ADMIN: 'ROLE_ADMIN',
  MODERATOR: 'ROLE_MODERATOR',
  USER: 'ROLE_USER',
  OWNER: 'ROLE_OWNER',
  EDITOR: 'ROLE_EDITOR',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

/**
 * Role hierarchy levels (for UI display ordering)
 */
export const ROLE_HIERARCHY: Record<RoleName, number> = {
  [ROLE_NAMES.OWNER]: 4,
  [ROLE_NAMES.ADMIN]: 3,
  [ROLE_NAMES.MODERATOR]: 2,
  [ROLE_NAMES.USER]: 1,
  [ROLE_NAMES.EDITOR]: 1,
};

/**
 * Check if a string is a valid role name
 */
export function isValidRoleName(name: string): name is RoleName {
  return Object.values(ROLE_NAMES).includes(name as RoleName);
}

/**
 * Validate role name format: ROLE_[A-Z][A-Z0-9_]+ (min 2 chars after prefix)
 */
export function validateRoleNameFormat(name: string): boolean {
  return /^ROLE_[A-Z][A-Z0-9_]+$/.test(name) && name.length > 7; // "ROLE_" + 2 chars min
}
