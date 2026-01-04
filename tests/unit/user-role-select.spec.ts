import { describe, it, expect } from 'vitest';
import { isRoleInherited } from '@/components/admin/user-role-select';

describe('isRoleInherited', () => {
  const inheritedRoles = [
    { id: '1', name: 'ROLE_USER', description: 'Basic user role' },
    { id: '2', name: 'ROLE_MODERATOR', description: 'Moderator role' },
  ];

  it('returns true when role is in inherited roles', () => {
    expect(isRoleInherited('1', inheritedRoles)).toBe(true);
    expect(isRoleInherited('2', inheritedRoles)).toBe(true);
  });

  it('returns false when role is not in inherited roles', () => {
    expect(isRoleInherited('3', inheritedRoles)).toBe(false);
    expect(isRoleInherited('999', inheritedRoles)).toBe(false);
  });

  it('returns false for empty inherited roles array', () => {
    expect(isRoleInherited('1', [])).toBe(false);
  });

  it('handles non-existent role ids', () => {
    expect(isRoleInherited('', inheritedRoles)).toBe(false);
    expect(isRoleInherited('abc', inheritedRoles)).toBe(false);
  });
});
