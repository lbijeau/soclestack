import { PrismaClient } from '@prisma/client';
import { ROLES } from '../src/lib/security/index';

const prisma = new PrismaClient();

async function migrateUsersToRoles() {
  console.log('🔄 Starting user role migration...\n');

  // Get all roles
  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.name, r.id]));

  console.log('📋 Available roles:');
  roles.forEach((r) => console.log(`  - ${r.name} (${r.id})`));
  console.log('');

  // Get all users without roles
  const users = await prisma.user.findMany({
    include: {
      userRoles: true,
    },
  });

  console.log(`👥 Found ${users.length} users total\n`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    if (user.userRoles.length > 0) {
      console.log(`⏭️  Skipping ${user.email} - already has roles`);
      skipped++;
      continue;
    }

    // Default all users to ROLE_USER
    // In a real migration, you'd read from a backup of the old role column
    const roleId = roleMap.get(ROLES.USER);
    if (!roleId) {
      console.error(`❌ ${ROLES.USER} not found!`);
      continue;
    }

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: roleId,
      },
    });

    console.log(`✅ Assigned ${ROLES.USER} to ${user.email}`);
    migrated++;
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
}

migrateUsersToRoles()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
