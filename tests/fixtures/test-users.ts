/**
 * Centralized test user credentials for e2e tests.
 *
 * These credentials match the users created by DatabaseHelpers.setupTestUsers()
 * and the seed data in tests/fixtures/data/test-users.json.
 *
 * Usage:
 *   import { TEST_USERS } from '@tests/fixtures/test-users';
 *   await loginPage.login(TEST_USERS.user.email, TEST_USERS.user.password);
 */

import { ROLE_NAMES as ROLES } from '@/lib/constants/roles';

/**
 * Platform test user credentials.
 * These users are created by DatabaseHelpers.setupTestUsers() for general e2e testing.
 */
export const TEST_USERS = {
  /** Standard verified user with ROLE_USER */
  user: {
    email: 'user@test.com',
    password: 'UserTest123!',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    role: ROLES.USER,
    verified: true,
    active: true,
  },

  /** Admin user with ROLE_ADMIN */
  admin: {
    email: 'admin@test.com',
    password: 'AdminTest123!',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    role: ROLES.ADMIN,
    verified: true,
    active: true,
  },

  /** Moderator user with ROLE_MODERATOR */
  moderator: {
    email: 'moderator@test.com',
    password: 'ModeratorTest123!',
    username: 'moderator',
    firstName: 'Moderator',
    lastName: 'User',
    role: ROLES.MODERATOR,
    verified: true,
    active: true,
  },

  /** Unverified user - email not confirmed */
  unverified: {
    email: 'unverified@test.com',
    password: 'UnverifiedTest123!',
    username: 'unverified',
    firstName: 'Unverified',
    lastName: 'User',
    role: ROLES.USER,
    verified: false,
    active: true,
  },

  /** Inactive/suspended user */
  inactive: {
    email: 'inactive@test.com',
    password: 'InactiveTest123!',
    username: 'inactive',
    firstName: 'Inactive',
    lastName: 'User',
    role: ROLES.USER,
    verified: true,
    active: false,
  },
} as const;

/** Type for test user keys */
export type TestUserKey = keyof typeof TEST_USERS;

/** Type for a single test user */
export type TestUser = (typeof TEST_USERS)[TestUserKey];

/**
 * Test passwords for various scenarios.
 * Use these instead of hardcoding passwords in tests.
 */
export const TEST_PASSWORDS = {
  /** A valid strong password for registration tests */
  valid: 'SecurePassword123!',
  /** An intentionally wrong password for failure tests */
  wrong: 'WrongPassword123!',
  /** A weak password that should fail validation */
  weak: 'weak',
  /** A password without special characters */
  noSpecial: 'Password123',
  /** A password without numbers */
  noNumbers: 'SecurePassword!',
  /** A password without uppercase */
  noUppercase: 'securepassword123!',
} as const;

/**
 * Test emails for various scenarios.
 */
export const TEST_EMAILS = {
  /** Non-existent user email for login failure tests */
  nonExistent: 'nonexistent@test.com',
  /** Email for SQL injection testing */
  sqlInjection: "admin@test.com'; UPDATE users SET role='ADMIN' WHERE email='user@test.com'; --",
  /** Email with special characters */
  specialChars: 'test+special@test.com',
} as const;

/**
 * Helper to get credentials as a tuple for spread operations.
 * @example
 *   await loginPage.login(...getCredentials('user'));
 */
export function getCredentials(userKey: TestUserKey): [string, string] {
  const user = TEST_USERS[userKey];
  return [user.email, user.password];
}

/**
 * Helper to get user data for database seeding.
 */
export function getUserData(userKey: TestUserKey) {
  const { email, password, username, firstName, lastName, role, verified, active } = TEST_USERS[userKey];
  return {
    email,
    password,
    username,
    firstName,
    lastName,
    role,
    emailVerified: verified,
    isActive: active,
  };
}
