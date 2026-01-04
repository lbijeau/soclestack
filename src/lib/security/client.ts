/**
 * Client-side security utilities for role-based permission checks.
 * These mirror the server-side isGranted() behavior for UI consistency.
 *
 * Note: These are for UI visibility only. Actual authorization is enforced
 * server-side in API routes and middleware.
 */

import type { PlatformRole } from '@/types/auth';

/**
 * Role constants matching server-side ROLES
 */
export const ROLES = {
  ADMIN: 'ROLE_ADMIN',
  MODERATOR: 'ROLE_MODERATOR',
  USER: 'ROLE_USER',
} as const;

// Role hierarchy for client-side permission checks (mirrors server-side isGranted)
const ROLE_HIERARCHY: Record<string, number> = {
  ROLE_USER: 1,
  ROLE_MODERATOR: 2,
  ROLE_ADMIN: 3,
};

/**
 * Check if a user role meets the minimum required role level.
 * Mirrors server-side isGranted() for client components.
 *
 * @param userRole - The user's current role (e.g., 'ROLE_ADMIN')
 * @param requiredRole - The minimum role required (e.g., 'ROLE_MODERATOR')
 * @returns true if user has at least the required role level
 */
export function hasMinimumRole(
  userRole: string | undefined,
  requiredRole: PlatformRole
): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole] ?? 0) >= ROLE_HIERARCHY[requiredRole];
}
