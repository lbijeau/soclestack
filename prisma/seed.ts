import { PrismaClient } from '@prisma/client';
import { ROLES } from '../src/lib/security/index';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Default password for all seed users: "password123"
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function seedRoles() {
  console.log('🔐 Seeding RBAC roles...');

  // Base role - all users have this
  const roleUser = await prisma.role.upsert({
    where: { name: ROLES.USER },
    update: {},
    create: {
      name: ROLES.USER,
      description: 'Basic platform access',
      isSystem: true,
    },
  });
  console.log(`✅ Created/verified: ${roleUser.name}`);

  // Moderator inherits from USER
  const roleModerator = await prisma.role.upsert({
    where: { name: ROLES.MODERATOR },
    update: { parentId: roleUser.id },
    create: {
      name: ROLES.MODERATOR,
      description: 'Content moderation capabilities',
      isSystem: true,
      parentId: roleUser.id,
    },
  });
  console.log(`✅ Created/verified: ${roleModerator.name} (inherits from ${roleUser.name})`);

  // Admin inherits from MODERATOR
  const roleAdmin = await prisma.role.upsert({
    where: { name: ROLES.ADMIN },
    update: { parentId: roleModerator.id },
    create: {
      name: ROLES.ADMIN,
      description: 'Full administrative access',
      isSystem: true,
      parentId: roleModerator.id,
    },
  });
  console.log(`✅ Created/verified: ${roleAdmin.name} (inherits from ${roleModerator.name})`);

  // Owner inherits from ADMIN (highest org-level role)
  const roleOwner = await prisma.role.upsert({
    where: { name: ROLES.OWNER },
    update: { parentId: roleAdmin.id },
    create: {
      name: ROLES.OWNER,
      description: 'Organization owner',
      isSystem: true,
      parentId: roleAdmin.id,
    },
  });
  console.log(`✅ Created/verified: ${roleOwner.name} (inherits from ${roleAdmin.name})`);

  // Editor - custom role example
  const roleEditor = await prisma.role.upsert({
    where: { name: ROLES.EDITOR },
    update: { parentId: roleUser.id },
    create: {
      name: ROLES.EDITOR,
      description: 'Content editor',
      isSystem: false,
      parentId: roleUser.id,
    },
  });
  console.log(`✅ Created/verified: ${roleEditor.name} (custom role, inherits from ${roleUser.name})`);

  console.log('\n📊 Role Hierarchy:');
  console.log('  ROLE_USER (base)');
  console.log('    ├── ROLE_MODERATOR');
  console.log('    │   └── ROLE_ADMIN');
  console.log('    │       └── ROLE_OWNER');
  console.log('    └── ROLE_EDITOR (custom)');

  return { roleUser, roleModerator, roleAdmin, roleOwner, roleEditor };
}

async function seedOrganizationsAndUsers(roles: {
  roleUser: { id: string };
  roleModerator: { id: string };
  roleAdmin: { id: string };
  roleOwner: { id: string };
  roleEditor: { id: string };
}) {
  console.log('\n👥 Seeding organizations and users...');

  // Create sample organization
  const org1 = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
    },
  });
  console.log(`✅ Created/verified organization: ${org1.name}`);

  // Create platform admin (super admin - no org context)
  const hashedPassword = await hashPassword('password123');
  const platformAdmin = await prisma.user.upsert({
    where: { email: 'admin@platform.com' },
    update: {
      password: hashedPassword,
      emailVerified: true,
    },
    create: {
      email: 'admin@platform.com',
      password: hashedPassword,
      firstName: 'Platform',
      lastName: 'Admin',
      emailVerified: true,
    },
  });

  // Assign platform-wide admin role (null organizationId)
  const existingAdminRole = await prisma.userRole.findFirst({
    where: {
      userId: platformAdmin.id,
      roleId: roles.roleAdmin.id,
      organizationId: null,
    },
  });
  if (!existingAdminRole) {
    await prisma.userRole.create({
      data: {
        userId: platformAdmin.id,
        roleId: roles.roleAdmin.id,
        organizationId: null, // Platform-wide
      },
    });
  }
  console.log(`✅ Assigned platform-wide ROLE_ADMIN to ${platformAdmin.email}`);

  // Create organization owner
  const orgOwner = await prisma.user.upsert({
    where: { email: 'owner@acme.com' },
    update: {
      password: hashedPassword,
      emailVerified: true,
    },
    create: {
      email: 'owner@acme.com',
      password: hashedPassword,
      firstName: 'Acme',
      lastName: 'Owner',
      emailVerified: true,
    },
  });

  // Assign org-scoped owner role
  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: orgOwner.id,
        roleId: roles.roleOwner.id,
        organizationId: org1.id,
      },
    },
    update: {},
    create: {
      userId: orgOwner.id,
      roleId: roles.roleOwner.id,
      organizationId: org1.id, // Scoped to org
    },
  });
  console.log(`✅ Assigned org-scoped ROLE_OWNER to ${orgOwner.email} (org: ${org1.slug})`);

  // Create organization editor
  const orgEditor = await prisma.user.upsert({
    where: { email: 'editor@acme.com' },
    update: {
      password: hashedPassword,
      emailVerified: true,
    },
    create: {
      email: 'editor@acme.com',
      password: hashedPassword,
      firstName: 'Acme',
      lastName: 'Editor',
      emailVerified: true,
    },
  });

  // Assign org-scoped editor role
  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: orgEditor.id,
        roleId: roles.roleEditor.id,
        organizationId: org1.id,
      },
    },
    update: {},
    create: {
      userId: orgEditor.id,
      roleId: roles.roleEditor.id,
      organizationId: org1.id, // Scoped to org
    },
  });
  console.log(`✅ Assigned org-scoped ROLE_EDITOR to ${orgEditor.email} (org: ${org1.slug})`);

  // Create regular user with platform-wide USER role
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {
      password: hashedPassword,
      emailVerified: true,
    },
    create: {
      email: 'user@example.com',
      password: hashedPassword,
      firstName: 'Regular',
      lastName: 'User',
      emailVerified: true,
    },
  });

  // Assign platform-wide user role
  const existingUserRole = await prisma.userRole.findFirst({
    where: {
      userId: regularUser.id,
      roleId: roles.roleUser.id,
      organizationId: null,
    },
  });
  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        userId: regularUser.id,
        roleId: roles.roleUser.id,
        organizationId: null, // Platform-wide
      },
    });
  }
  console.log(`✅ Assigned platform-wide ROLE_USER to ${regularUser.email}`);

  console.log('\n📋 Summary:');
  console.log(`  Platform Admin: ${platformAdmin.email} (ROLE_ADMIN, platform-wide)`);
  console.log(`  Org Owner: ${orgOwner.email} (ROLE_OWNER @ ${org1.slug})`);
  console.log(`  Org Editor: ${orgEditor.email} (ROLE_EDITOR @ ${org1.slug})`);
  console.log(`  Regular User: ${regularUser.email} (ROLE_USER, platform-wide)`);
  console.log('\n🔑 All users have password: password123');
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    const roles = await seedRoles();
    await seedOrganizationsAndUsers(roles);
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
