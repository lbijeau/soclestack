import { PrismaClient } from '@prisma/client';
import { TestUser, TestDataFactory } from './test-data-factory';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ROLE_NAMES as ROLES } from '@/lib/constants/roles';
import { generateTOTPSecret } from './totp-helpers';
import {
  ORG_TEST_USERS,
  ORG_ROLE_TO_DB_ROLE,
  DB_ROLE_TO_ORG_ROLE,
  INVITE_ROLE_TO_DB_ROLE,
  TEST_INVITE_EMAILS,
  generateUniqueSlug,
  type OrgRole,
  type InviteRole,
} from './org-test-constants';

// Create a test-specific Prisma client
// For e2e tests, we need to use the same database as the running application.
// The app uses DATABASE_URL, so tests should too. TEST_DATABASE_URL is for
// isolated unit/integration tests that don't interact with the running app.
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      // Use DATABASE_URL for e2e tests since we need to match the running app's database
      url: process.env.DATABASE_URL,
    },
  },
});

export class DatabaseHelpers {
  private static prisma = testPrisma;

  /**
   * Clean up all test data from the database
   */
  static async cleanupDatabase(): Promise<void> {
    try {
      // Clean up in order to respect foreign key constraints
      await this.prisma.userSession.deleteMany({});

      // Delete backup codes for test users first (foreign key constraint)
      await this.prisma.backupCode.deleteMany({
        where: {
          user: {
            email: {
              endsWith: '@test.com',
            },
          },
        },
      });

      // Clean up test organizations (invites, memberships, orgs) before deleting users
      await this.cleanupTestOrganizations();

      // Delete UserRole records for test users (platform-wide roles)
      await this.prisma.userRole.deleteMany({
        where: {
          user: {
            email: {
              endsWith: '@test.com',
            },
          },
        },
      });

      await this.prisma.user.deleteMany({
        where: {
          email: {
            endsWith: '@test.com',
          },
        },
      });

      console.log('🧹 Database cleanup completed');
    } catch (error) {
      console.error('Database cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Create a test user in the database
   */
  static async createTestUser(userData: Partial<TestUser> = {}): Promise<any> {
    const user = TestDataFactory.createUser(userData);
    const hashedPassword = await bcrypt.hash(user.password, 12);

    try {
      const createdUser = await this.prisma.user.upsert({
        where: { email: user.email },
        update: {
          password: hashedPassword,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          // Reset 2FA state to ensure clean state for tests
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorVerified: false,
        },
        create: {
          email: user.email,
          password: hashedPassword,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
        },
      });

      // Delete any existing backup codes to ensure clean 2FA state
      await this.prisma.backupCode.deleteMany({
        where: { userId: createdUser.id },
      });

      // Assign role if provided (using unified role architecture)
      if (user.role) {
        await this.assignUserRole({
          userId: createdUser.id,
          roleName: user.role,
          organizationId: null, // Platform-wide by default for test users
        });
      }

      // Return user with original password for test use
      return {
        ...createdUser,
        plainPassword: user.password,
      };
    } catch (error: any) {
      // Handle unique constraint error on username (P2002) from parallel test execution
      // Another worker may have created the user first - fetch and return existing record
      if (error.code === 'P2002') {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: user.email },
        });
        if (existingUser) {
          return {
            ...existingUser,
            plainPassword: user.password,
          };
        }
      }
      console.error('Failed to create test user:', error);
      throw error;
    }
  }

  /**
   * Create multiple test users
   */
  static async createTestUsers(count: number, userData: Partial<TestUser> = {}): Promise<any[]> {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser({
        ...userData,
        email: `testuser${i}@test.com`,
      });
      users.push(user);
    }
    return users;
  }

  /**
   * Create a complete test environment with predefined users
   */
  static async setupTestUsers(): Promise<{
    adminUser: any;
    moderatorUser: any;
    regularUser: any;
    unverifiedUser: any;
    inactiveUser: any;
  }> {
    // Clean up existing test users first
    await this.cleanupDatabase();

    console.log('Creating admin user...');
    const adminUser = await this.createTestUser({
      email: 'admin@test.com',
      password: 'AdminTest123!',
      role: ROLES.ADMIN,
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
    });

    const moderatorUser = await this.createTestUser({
      email: 'moderator@test.com',
      password: 'ModeratorTest123!',
      role: ROLES.MODERATOR,
      username: 'moderator',
      firstName: 'Moderator',
      lastName: 'User',
    });

    const regularUser = await this.createTestUser({
      email: 'user@test.com',
      password: 'UserTest123!',
      role: ROLES.USER,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
    });

    const unverifiedUser = await this.createTestUser({
      email: 'unverified@test.com',
      password: 'UnverifiedTest123!',
      role: ROLES.USER,
      emailVerified: false,
      username: 'unverified',
      firstName: 'Unverified',
      lastName: 'User',
    });

    const inactiveUser = await this.createTestUser({
      email: 'inactive@test.com',
      password: 'InactiveTest123!',
      role: ROLES.USER,
      isActive: false,
      username: 'inactive',
      firstName: 'Inactive',
      lastName: 'User',
    });

    return {
      adminUser,
      moderatorUser,
      regularUser,
      unverifiedUser,
      inactiveUser,
    };
  }

  /**
   * Find a user by email
   */
  static async findUserByEmail(email: string): Promise<any> {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Update a user's verification status
   */
  static async verifyUser(email: string): Promise<any> {
    return await this.prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
  }

  /**
   * Create a user session
   */
  static async createUserSession(userId: string, sessionData: any = {}): Promise<any> {
    const sessionToken = TestDataFactory.createUserSession(userId, sessionData);

    return await this.prisma.userSession.create({
      data: sessionToken,
    });
  }

  /**
   * Get all sessions for a user
   */
  static async getUserSessions(userId: string): Promise<any[]> {
    return await this.prisma.userSession.findMany({
      where: { userId },
    });
  }

  /**
   * Delete all sessions for a user
   */
  static async deleteUserSessions(userId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  /**
   * Reset password for a user
   */
  static async resetUserPassword(email: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  }

  /**
   * Set password reset token
   */
  static async setPasswordResetToken(email: string, token: string): Promise<void> {
    await this.prisma.user.update({
      where: { email },
      data: {
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
      },
    });
  }

  /**
   * Create bulk test data for performance testing
   */
  static async createBulkTestData(userCount: number = 100): Promise<{
    users: any[];
    sessions: any[];
  }> {
    console.log(`Creating ${userCount} test users for performance testing...`);

    const users = [];
    const sessions = [];

    for (let i = 0; i < userCount; i++) {
      const user = await this.createTestUser({
        email: `perftest${i}@test.com`,
        username: `perfuser${i}`,
      });
      users.push(user);

      // Create 1-3 sessions per user
      const sessionCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < sessionCount; j++) {
        const session = await this.createUserSession(user.id);
        sessions.push(session);
      }
    }

    console.log(`Created ${users.length} users and ${sessions.length} sessions`);
    return { users, sessions };
  }

  /**
   * Get database statistics for monitoring
   */
  static async getDatabaseStats(): Promise<{
    userCount: number;
    sessionCount: number;
    activeUsers: number;
    verifiedUsers: number;
    adminUsers: number;
  }> {
    // Get admin role ID
    const adminRole = await this.prisma.role.findUnique({
      where: { name: ROLES.ADMIN },
    });

    const [
      userCount,
      sessionCount,
      activeUsers,
      verifiedUsers,
      adminUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.userSession.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { emailVerified: true } }),
      adminRole
        ? this.prisma.userRole.count({
            where: { roleId: adminRole.id },
          })
        : 0,
    ]);

    return {
      userCount,
      sessionCount,
      activeUsers,
      verifiedUsers,
      adminUsers,
    };
  }

  /**
   * Seed the database with essential test data
   */
  static async seedDatabase(): Promise<void> {
    console.log('🌱 Seeding database with test data...');

    try {
      // First clean up existing test data
      await this.cleanupDatabase();

      // Create essential test users
      await this.setupTestUsers();

      // Create some additional test users for various scenarios
      await this.createTestUsers(10);

      console.log('✅ Database seeding completed');
    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    }
  }

  /**
   * Assign a role to a user (create UserRole record)
   * Handles parallel test execution by catching unique constraint errors
   */
  static async assignUserRole(data: {
    userId: string;
    roleName: string;
    organizationId: string | null;
  }): Promise<any> {
    const role = await this.prisma.role.findUnique({
      where: { name: data.roleName },
    });

    if (!role) {
      throw new Error(`Role ${data.roleName} not found`);
    }

    try {
      return await this.prisma.userRole.create({
        data: {
          userId: data.userId,
          roleId: role.id,
          organizationId: data.organizationId,
        },
        include: {
          role: true,
          organization: true,
        },
      });
    } catch (error: any) {
      // If unique constraint error (P2002), the role is already assigned
      // This can happen when tests run in parallel - fetch and return existing record
      if (error.code === 'P2002') {
        return await this.prisma.userRole.findFirst({
          where: {
            userId: data.userId,
            roleId: role.id,
            organizationId: data.organizationId,
          },
          include: {
            role: true,
            organization: true,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Close database connection
   */
  static async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // ===========================================
  // Organization Management Methods
  // ===========================================

  /**
   * Create a test organization with an owner
   */
  static async createTestOrganization(data: {
    name: string;
    slug?: string;
    ownerEmail: string;
  }): Promise<any> {
    // Generate slug from name if not provided
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Find or create the owner user
    let owner = await this.prisma.user.findUnique({
      where: { email: data.ownerEmail },
    });

    if (!owner) {
      owner = await this.createTestUser({ email: data.ownerEmail });
    }

    // Create the organization
    const organization = await this.prisma.organization.create({
      data: {
        name: data.name,
        slug,
      },
    });

    // Add owner as ROLE_OWNER in the organization
    await this.addMemberToOrganization(organization.id, owner.id, 'OWNER');

    return {
      ...organization,
      owner,
    };
  }

  /**
   * Delete a test organization and all related data
   */
  static async deleteTestOrganization(orgId: string): Promise<void> {
    // Delete invites first
    await this.prisma.organizationInvite.deleteMany({
      where: { organizationId: orgId },
    });

    // Delete UserRole records for this organization
    await this.prisma.userRole.deleteMany({
      where: { organizationId: orgId },
    });

    // Delete the organization
    await this.prisma.organization.delete({
      where: { id: orgId },
    });
  }

  /**
   * Clean up all test organizations (orgs owned by @test.com users)
   */
  static async cleanupTestOrganizations(): Promise<void> {
    // Find all orgs owned by test users
    const testOrgs = await this.prisma.organization.findMany({
      where: {
        userRoles: {
          some: {
            user: {
              email: {
                endsWith: '@test.com',
              },
            },
            role: {
              name: ROLES.OWNER,
            },
          },
        },
      },
    });

    // Use Promise.allSettled to continue even if some deletions fail
    const results = await Promise.allSettled(
      testOrgs.map(org => this.deleteTestOrganization(org.id))
    );

    // Log any failures for debugging
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`Failed to cleanup ${failures.length} organizations:`, failures.map(f => f.reason));
    }
  }

  /**
   * Add a member to an organization with a specific role
   */
  static async addMemberToOrganization(
    orgId: string,
    userId: string,
    role: OrgRole
  ): Promise<any> {
    // Use centralized role mapping from org-test-constants
    const roleName = ORG_ROLE_TO_DB_ROLE[role];
    const roleRecord = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!roleRecord) {
      throw new Error(`Role ${roleName} not found`);
    }

    try {
      return await this.prisma.userRole.create({
        data: {
          userId,
          roleId: roleRecord.id,
          organizationId: orgId,
        },
        include: {
          user: true,
          role: true,
          organization: true,
        },
      });
    } catch (error: any) {
      // Handle unique constraint error (P2002) from parallel test execution
      if (error.code === 'P2002') {
        return await this.prisma.userRole.findFirst({
          where: {
            userId,
            roleId: roleRecord.id,
            organizationId: orgId,
          },
          include: {
            user: true,
            role: true,
            organization: true,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Remove a member from an organization
   */
  static async removeMemberFromOrganization(orgId: string, userId: string): Promise<void> {
    await this.prisma.userRole.deleteMany({
      where: {
        organizationId: orgId,
        userId,
      },
    });
  }

  /**
   * Get a member's role in an organization
   */
  static async getMemberRole(orgId: string, userId: string): Promise<OrgRole | null> {
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        organizationId: orgId,
        userId,
      },
      include: {
        role: true,
      },
    });

    if (!userRole) {
      return null;
    }

    // Use centralized role mapping from org-test-constants
    return DB_ROLE_TO_ORG_ROLE[userRole.role.name] || null;
  }

  /**
   * Create a test invite for an organization
   */
  static async createTestInvite(
    orgId: string,
    email: string,
    role: InviteRole,
    options?: { expiresAt?: Date; invitedById?: string }
  ): Promise<{ invite: any; token: string }> {
    // Use centralized role mapping from org-test-constants
    const roleName = INVITE_ROLE_TO_DB_ROLE[role];
    const roleRecord = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!roleRecord) {
      throw new Error(`Role ${roleName} not found`);
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Default expiry: 7 days from now
    const expiresAt = options?.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Get invitedById - use provided or find org owner
    let invitedById = options?.invitedById;
    if (!invitedById) {
      const ownerRole = await this.prisma.userRole.findFirst({
        where: {
          organizationId: orgId,
          role: {
            name: ROLES.OWNER,
          },
        },
      });
      invitedById = ownerRole?.userId;
    }

    if (!invitedById) {
      throw new Error('No invitedById provided and no owner found for organization');
    }

    const invite = await this.prisma.organizationInvite.create({
      data: {
        email,
        roleId: roleRecord.id,
        token,
        expiresAt,
        organizationId: orgId,
        invitedById,
      },
      include: {
        organization: true,
        invitedBy: true,
      },
    });

    return { invite, token };
  }

  /**
   * Get an invite by its token
   */
  static async getInviteByToken(token: string): Promise<any> {
    return await this.prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: true,
        invitedBy: true,
      },
    });
  }

  /**
   * Expire an invite by setting its expiresAt to the past
   */
  static async expireInvite(inviteId: string): Promise<void> {
    await this.prisma.organizationInvite.update({
      where: { id: inviteId },
      data: {
        expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      },
    });
  }

  /**
   * Set up a complete test organization with various user roles and invites.
   * Uses centralized test credentials from org-test-constants.ts
   */
  static async setupTestOrganization(): Promise<{
    org: any;
    owner: any;
    admin: any;
    member: any;
    nonMember: any;
    pendingInvite: { invite: any; token: string };
    expiredInvite: { invite: any; token: string };
  }> {
    // Create owner user first with known password for auth helpers
    const ownerUser = await this.createTestUser(ORG_TEST_USERS.owner);

    // Create the organization with the owner using unique slug for test isolation
    const orgResult = await this.createTestOrganization({
      name: 'Test Organization',
      slug: generateUniqueSlug(),
      ownerEmail: ORG_TEST_USERS.owner.email,
    });

    const org = orgResult;
    const owner = ownerUser;

    // Create admin user and add to organization
    const admin = await this.createTestUser(ORG_TEST_USERS.admin);
    await this.addMemberToOrganization(org.id, admin.id, 'ADMIN');

    // Create member user and add to organization
    const member = await this.createTestUser(ORG_TEST_USERS.member);
    await this.addMemberToOrganization(org.id, member.id, 'MEMBER');

    // Create non-member user (not in organization)
    const nonMember = await this.createTestUser(ORG_TEST_USERS.nonMember);

    // Create pending invite
    const pendingInvite = await this.createTestInvite(
      org.id,
      TEST_INVITE_EMAILS.pending,
      'MEMBER',
      { invitedById: owner.id }
    );

    // Create expired invite
    const expiredInvite = await this.createTestInvite(
      org.id,
      TEST_INVITE_EMAILS.expired,
      'MEMBER',
      {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        invitedById: owner.id,
      }
    );

    return {
      org,
      owner,
      admin,
      member,
      nonMember,
      pendingInvite,
      expiredInvite,
    };
  }

  /**
   * Enable 2FA for a user (for testing 2FA login flows)
   */
  static async enable2FA(
    email: string,
    options: { secret?: string; backupCodes?: string[] } = {}
  ): Promise<{ secret: string; backupCodes: string[] }> {
    const secret = options.secret || generateTOTPSecret();
    const backupCodes = options.backupCodes || [
      'ABCD1234',
      'EFGH5678',
      'IJKL9012',
      'MNOP3456',
      'QRST7890',
      'UVWX1234',
      'YZAB5678',
      'CDEF9012',
    ];

    const user = await this.prisma.user.update({
      where: { email },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        twoFactorVerified: true,
      },
    });

    // Create backup codes
    for (const code of backupCodes) {
      const codeHash = await bcrypt.hash(code, 10);
      await this.prisma.backupCode.create({
        data: {
          userId: user.id,
          codeHash,
        },
      });
    }

    return { secret, backupCodes };
  }

  /**
   * Disable 2FA for a user
   */
  static async disable2FA(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return;

    // Delete backup codes
    await this.prisma.backupCode.deleteMany({
      where: { userId: user.id },
    });

    // Reset 2FA fields
    await this.prisma.user.update({
      where: { email },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorVerified: false,
      },
    });
  }

  /**
   * Check if user has 2FA enabled
   */
  static async has2FAEnabled(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { twoFactorEnabled: true },
    });

    return user?.twoFactorEnabled || false;
  }

  /**
   * Get 2FA secret for a user (for generating test codes)
   */
  static async get2FASecret(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { twoFactorSecret: true },
    });

    return user?.twoFactorSecret || null;
  }

  /**
   * Create a user with 2FA already enabled
   */
  static async createUserWith2FA(
    userData: Partial<TestUser> = {}
  ): Promise<{
    user: any;
    secret: string;
    backupCodes: string[];
  }> {
    const user = await this.createTestUser(userData);
    const { secret, backupCodes } = await this.enable2FA(user.email);

    return {
      user: { ...user, twoFactorEnabled: true },
      secret,
      backupCodes,
    };
  }

  /**
   * Create pending 2FA token for testing login flow
   * This simulates the state after password verification but before 2FA
   */
  static async createPending2FAToken(userId: string): Promise<string> {
    // In a real implementation, this would be stored in Redis or a pending_2fa table
    // For testing, we'll create a simple JWT-like token
    const token = Buffer.from(
      JSON.stringify({
        userId,
        type: 'pending_2fa',
        exp: Date.now() + 300000, // 5 minutes
      })
    ).toString('base64url');

    return token;
  }
}

// Export the prisma instance for direct use in tests if needed
export { testPrisma };