#!/usr/bin/env node

/**
 * Database seeding script for demo users
 * Creates demo users for testing and demonstration purposes
 *
 * Requires: Run `npx prisma db seed` first to create RBAC roles
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo users...');

  try {
    // Verify roles exist (should be created by prisma/seed.ts)
    const roles = await prisma.role.findMany();
    if (roles.length === 0) {
      console.error('❌ No roles found. Run `npx prisma db seed` first to create RBAC roles.');
      process.exit(1);
    }

    const roleMap = Object.fromEntries(roles.map(r => [r.name, r.id]));
    console.log(`Found ${roles.length} roles: ${roles.map(r => r.name).join(', ')}`);

    // Clean up existing demo users and their role assignments
    const demoEmails = ['admin@demo.com', 'user@demo.com', 'moderator@demo.com'];

    await prisma.userRole.deleteMany({
      where: { user: { email: { in: demoEmails } } }
    });

    await prisma.userSession.deleteMany({
      where: { user: { email: { in: demoEmails } } }
    });

    await prisma.user.deleteMany({
      where: { email: { in: demoEmails } }
    });

    // Demo user definitions (role is used for assignment, not stored on user)
    const demoUsers = [
      {
        email: 'admin@demo.com',
        username: 'admin',
        firstName: 'Demo',
        lastName: 'Admin',
        roleName: 'ROLE_ADMIN',
      },
      {
        email: 'user@demo.com',
        username: 'demouser',
        firstName: 'Demo',
        lastName: 'User',
        roleName: 'ROLE_USER',
      },
      {
        email: 'moderator@demo.com',
        username: 'moderator',
        firstName: 'Demo',
        lastName: 'Moderator',
        roleName: 'ROLE_MODERATOR',
      }
    ];

    console.log('Creating demo users...');
    const hashedPassword = await bcrypt.hash('Demo123!', 12);

    for (const { roleName, ...userData } of demoUsers) {
      const roleId = roleMap[roleName];
      if (!roleId) {
        console.error(`❌ Role ${roleName} not found. Skipping user ${userData.email}`);
        continue;
      }

      const user = await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          passwordChangedAt: new Date(),
          userRoles: {
            create: { roleId }
          }
        },
        include: { userRoles: { include: { role: true } } }
      });

      const assignedRole = user.userRoles[0]?.role.name || 'none';
      console.log(`✅ Created user: ${user.email} with role ${assignedRole}`);
    }

    console.log('\n🎉 Demo users created successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                     Demo Users                          │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ Admin User:                                             │');
    console.log('│   Email: admin@demo.com                                 │');
    console.log('│   Password: Demo123!                                    │');
    console.log('│   Role: ROLE_ADMIN                                      │');
    console.log('│                                                         │');
    console.log('│ Regular User:                                           │');
    console.log('│   Email: user@demo.com                                  │');
    console.log('│   Password: Demo123!                                    │');
    console.log('│   Role: ROLE_USER                                       │');
    console.log('│                                                         │');
    console.log('│ Moderator User:                                         │');
    console.log('│   Email: moderator@demo.com                             │');
    console.log('│   Password: Demo123!                                    │');
    console.log('│   Role: ROLE_MODERATOR                                  │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('\n🚀 You can now login at http://localhost:3000/login');

  } catch (error) {
    console.error('❌ Error seeding demo users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();