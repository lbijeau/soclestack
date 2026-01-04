import { PrismaClient } from '@prisma/client';
import { ROLES } from '../src/lib/security/index';

const prisma = new PrismaClient();

async function promoteDemoUsers() {
  console.log('🔄 Promoting demo users to correct roles...\n');

  // Get all roles
  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.name, r.id]));

  // Promote admin@demo.com to ADMIN
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@demo.com' },
  });

  if (adminUser) {
    // Remove existing roles and add ADMIN
    await prisma.userRole.deleteMany({ where: { userId: adminUser.id } });
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: roleMap.get(ROLES.ADMIN)!,
      },
    });
    console.log(`✅ Promoted admin@demo.com to ${ROLES.ADMIN}`);
  }

  // Promote moderator@demo.com to MODERATOR
  const moderatorUser = await prisma.user.findUnique({
    where: { email: 'moderator@demo.com' },
  });

  if (moderatorUser) {
    // Remove existing roles and add MODERATOR
    await prisma.userRole.deleteMany({ where: { userId: moderatorUser.id } });
    await prisma.userRole.create({
      data: {
        userId: moderatorUser.id,
        roleId: roleMap.get(ROLES.MODERATOR)!,
      },
    });
    console.log(`✅ Promoted moderator@demo.com to ${ROLES.MODERATOR}`);
  }

  console.log('\n🎉 Demo user promotion complete!');
}

promoteDemoUsers()
  .catch((e) => {
    console.error('Promotion failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
