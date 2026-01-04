/**
 * Client-side security utilities for role-based permission checks.
 * These mirror the server-side isGranted() behavior for UI consistency.
 *
 * Note: These are for UI visibility only. Actual authorization is enforced
 * server-side in API routes and middleware.
 */

// Role hierarchy for client-side permission checks (mirrors server-side isGranted)
export const ROLE_HIERARCHY: Record<string, number> = {
  USER: 1,
  MODERATOR: 2,
  ADMIN: 3,
};

/**
 * Check if a user role meets the minimum required role level.
 * Mirrors server-side isGranted() for client components.
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum role required
 * @returns true if user has at least the required role level
 */
export function hasMinimumRole(
  userRole: string | undefined,
  requiredRole: 'USER' | 'MODERATOR' | 'ADMIN'
): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole] ?? 0) >= ROLE_HIERARCHY[requiredRole];
}
