import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRoles() {
  console.log('🔐 Seeding RBAC roles...');

  // Create role hierarchy: ROLE_USER <- ROLE_MODERATOR <- ROLE_ADMIN
  // (Child inherits parent's permissions)
  const roleUser = await prisma.role.upsert({
    where: { name: 'ROLE_USER' },
    update: {},
    create: {
      name: 'ROLE_USER',
      description: 'Base role for all authenticated users',
      isSystem: true,
    },
  });
  console.log(`✅ Created/verified: ${roleUser.name}`);

  const roleModerator = await prisma.role.upsert({
    where: { name: 'ROLE_MODERATOR' },
    update: { parentId: roleUser.id },
    create: {
      name: 'ROLE_MODERATOR',
      description: 'Can manage users and view reports',
      isSystem: true,
      parentId: roleUser.id,
    },
  });
  console.log(`✅ Created/verified: ${roleModerator.name} (inherits from ${roleUser.name})`);

  const roleAdmin = await prisma.role.upsert({
    where: { name: 'ROLE_ADMIN' },
    update: { parentId: roleModerator.id },
    create: {
      name: 'ROLE_ADMIN',
      description: 'Full platform administration',
      isSystem: true,
      parentId: roleModerator.id,
    },
  });
  console.log(`✅ Created/verified: ${roleAdmin.name} (inherits from ${roleModerator.name})`);

  console.log('\n📊 Role Hierarchy:');
  console.log('  ROLE_USER (base)');
  console.log('    └── ROLE_MODERATOR');
  console.log('        └── ROLE_ADMIN');

  return { roleUser, roleModerator, roleAdmin };
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    await seedRoles();
    console.log('\n🎉 Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
