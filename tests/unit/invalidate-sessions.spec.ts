import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    userSession: {
      deleteMany: vi.fn(),
    },
  },
}));

// Import after mocks
import { prisma } from '@/lib/db';
import { invalidateUserSessions } from '@/lib/auth';

describe('invalidateUserSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete all sessions for the specified user', async () => {
    vi.mocked(prisma.userSession.deleteMany).mockResolvedValue({ count: 3 });

    const result = await invalidateUserSessions('user-123');

    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
    });
    expect(result).toBe(3);
  });

  it('should return 0 when user has no sessions', async () => {
    vi.mocked(prisma.userSession.deleteMany).mockResolvedValue({ count: 0 });

    const result = await invalidateUserSessions('user-no-sessions');

    expect(result).toBe(0);
  });

  it('should return 0 and log error when database fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(prisma.userSession.deleteMany).mockRejectedValue(new Error('DB error'));

    const result = await invalidateUserSessions('user-123');

    expect(result).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Invalidate user sessions error:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
