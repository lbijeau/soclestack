import { PrismaClient } from '@prisma/client';
import { TestUser, TestDataFactory } from './test-data-factory';
import bcrypt from 'bcryptjs';
import { ROLES } from '@/lib/constants/roles';

// Create a test-specific Prisma client
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
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
      const createdUser = await this.prisma.user.create({
        data: {
          email: user.email,
          password: hashedPassword,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
        },
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
    } catch (error) {
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
   * Close database connection
   */
  static async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Export the prisma instance for direct use in tests if needed
export { testPrisma };