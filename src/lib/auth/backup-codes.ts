import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { SECURITY_CONFIG } from '../config/security';

const { backupCodeCount } = SECURITY_CONFIG.twoFactor;

function generateCode(): string {
  // Generate 8-character alphanumeric code (easy to read/type)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function generateBackupCodes(userId: string): Promise<string[]> {
  // Delete existing backup codes
  await prisma.backupCode.deleteMany({
    where: { userId },
  });

  const codes: string[] = [];

  for (let i = 0; i < backupCodeCount; i++) {
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);

    await prisma.backupCode.create({
      data: {
        userId,
        codeHash,
      },
    });

    codes.push(code);
  }

  return codes;
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  // Normalize: uppercase, remove spaces/dashes
  const normalizedCode = code.toUpperCase().replace(/[\s-]/g, '');

  const backupCodes = await prisma.backupCode.findMany({
    where: {
      userId,
      usedAt: null, // Only unused codes
    },
  });

  for (const backupCode of backupCodes) {
    const isMatch = await bcrypt.compare(normalizedCode, backupCode.codeHash);
    if (isMatch) {
      // Mark as used
      await prisma.backupCode.update({
        where: { id: backupCode.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }

  return false;
}

export async function getRemainingBackupCodeCount(userId: string): Promise<number> {
  return prisma.backupCode.count({
    where: {
      userId,
      usedAt: null,
    },
  });
}

export async function deleteAllBackupCodes(userId: string): Promise<void> {
  await prisma.backupCode.deleteMany({
    where: { userId },
  });
}
