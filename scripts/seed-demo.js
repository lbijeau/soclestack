#!/usr/bin/env node

/**
 * Database seeding script for demo users
 * Creates demo users for testing and demonstration purposes
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo users...');

  try {
    // Clean up existing demo users
    await prisma.userSession.deleteMany({
      where: {
        user: {
          email: {
            in: [
              'admin@demo.com',
              'user@demo.com',
              'moderator@demo.com'
            ]
          }
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'admin@demo.com',
            'user@demo.com',
            'moderator@demo.com'
          ]
        }
      }
    });

    // Create demo users
    const demoUsers = [
      {
        email: 'admin@demo.com',
        username: 'admin',
        password: await bcrypt.hash('Demo123!', 12),
        firstName: 'Demo',
        lastName: 'Admin',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      {
        email: 'user@demo.com',
        username: 'demouser',
        password: await bcrypt.hash('Demo123!', 12),
        firstName: 'Demo',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      {
        email: 'moderator@demo.com',
        username: 'moderator',
        password: await bcrypt.hash('Demo123!', 12),
        firstName: 'Demo',
        lastName: 'Moderator',
        role: 'MODERATOR',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }
    ];

    console.log('Creating demo users...');
    for (const userData of demoUsers) {
      const user = await prisma.user.create({
        data: userData,
      });
      console.log(`✅ Created ${user.role.toLowerCase()}: ${user.email}`);
    }

    console.log('\n🎉 Demo users created successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                     Demo Users                          │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ Admin User:                                             │');
    console.log('│   Email: admin@demo.com                                 │');
    console.log('│   Password: Demo123!                                    │');
    console.log('│   Role: ADMIN                                           │');
    console.log('│                                                         │');
    console.log('│ Regular User:                                           │');
    console.log('│   Email: user@demo.com                                  │');
    console.log('│   Password: Demo123!                                    │');
    console.log('│   Role: USER                                            │');
    console.log('│                                                         │');
    console.log('│ Moderator User:                                         │');
    console.log('│   Email: moderator@demo.com                             │');
    console.log('│   Password: Demo123!                                    │');
    console.log('│   Role: MODERATOR                                       │');
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