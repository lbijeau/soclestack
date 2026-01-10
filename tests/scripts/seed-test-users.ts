/**
 * Seed test users with proper roles for e2e tests
 * Run with: npx tsx tests/scripts/seed-test-users.ts
 */

import { DatabaseHelpers, testPrisma } from '../utils/database-helpers';

async function main() {
  console.log('Seeding test users...');

  try {
    const result = await DatabaseHelpers.setupTestUsers();
    console.log('Test users seeded successfully');

    // Verify roles were assigned
    const user = await testPrisma.user.findUnique({
      where: { email: 'user@test.com' },
      include: { userRoles: { include: { role: true } } }
    });
    console.log('User roles after seeding:', user?.userRoles.map(r => r.role.name));

    if (!user?.userRoles.length) {
      console.error('WARNING: User has no roles assigned!');
    }
  } catch (error) {
    console.error('Failed to seed test users:', error);
    process.exit(1);
  } finally {
    await DatabaseHelpers.disconnect();
  }
}

main();
