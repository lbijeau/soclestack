/**
 * Shared constants for organization e2e tests
 * Centralizes test credentials and role mappings to avoid duplication
 */

import { ROLE_NAMES as ROLES } from '@/lib/constants/roles';

// ===========================================
// Test User Credentials
// ===========================================

export const ORG_TEST_USERS = {
  owner: {
    email: 'org-owner@test.com',
    password: 'OwnerTest123!',
    username: 'orgowner',
    firstName: 'Org',
    lastName: 'Owner',
  },
  admin: {
    email: 'org-admin@test.com',
    password: 'AdminTest123!',
    username: 'orgadmin',
    firstName: 'Org',
    lastName: 'Admin',
  },
  member: {
    email: 'org-member@test.com',
    password: 'MemberTest123!',
    username: 'orgmember',
    firstName: 'Org',
    lastName: 'Member',
  },
  nonMember: {
    email: 'non-member@test.com',
    password: 'NonMemberTest123!',
    username: 'nonmember',
    firstName: 'Non',
    lastName: 'Member',
  },
} as const;

// ===========================================
// Organization Role Mapping
// ===========================================

/**
 * Simplified role names used in tests and UI
 */
export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * Maps simplified role names to database role names.
 *
 * IMPORTANT: The 'MEMBER' role maps to 'ROLE_USER' in the database.
 * This is because organization members use the base user role,
 * while OWNER and ADMIN have elevated permissions within the org.
 */
export const ORG_ROLE_TO_DB_ROLE: Record<OrgRole, string> = {
  OWNER: ROLES.OWNER,
  ADMIN: ROLES.ADMIN,
  MEMBER: ROLES.USER, // Organization members use ROLE_USER
} as const;

/**
 * Maps database role names back to simplified role names
 */
export const DB_ROLE_TO_ORG_ROLE: Record<string, OrgRole> = {
  [ROLES.OWNER]: 'OWNER',
  [ROLES.ADMIN]: 'ADMIN',
  [ROLES.USER]: 'MEMBER',
} as const;

/**
 * Invite roles (cannot invite as OWNER)
 */
export type InviteRole = 'ADMIN' | 'MEMBER';

/**
 * Maps invite roles to database role names
 */
export const INVITE_ROLE_TO_DB_ROLE: Record<InviteRole, string> = {
  ADMIN: ROLES.ADMIN,
  MEMBER: ROLES.USER,
} as const;

// ===========================================
// Test Organization Defaults
// ===========================================

export const DEFAULT_TEST_ORG = {
  name: 'Test Organization',
  slugPrefix: 'test-org',
} as const;

// ===========================================
// Test Invite Emails
// ===========================================

export const TEST_INVITE_EMAILS = {
  pending: 'pending-invite@test.com',
  expired: 'expired-invite@test.com',
} as const;

// ===========================================
// Test Timeouts
// ===========================================

/**
 * Standard timeouts for various test operations.
 * Use these instead of hardcoding timeout values.
 */
export const TEST_TIMEOUTS = {
  /** Default timeout for page loads and navigation */
  pageLoad: 10000,
  /** Timeout for authentication operations */
  auth: 15000,
  /** Short timeout for element visibility checks */
  elementVisible: 5000,
  /** Timeout for network idle state */
  networkIdle: 10000,
  /** Timeout for form submissions */
  formSubmit: 10000,
} as const;

/**
 * Generate a unique slug for test isolation in parallel test runs
 */
export function generateUniqueSlug(prefix: string = DEFAULT_TEST_ORG.slugPrefix): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate a unique email for test isolation
 */
export function generateUniqueEmail(prefix: string): string {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return `${prefix}-${uniqueId}@test.com`;
}
