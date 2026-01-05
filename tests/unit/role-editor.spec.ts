import { describe, it, expect } from 'vitest';
import {
  validateRoleName,
  isDescendantOf,
} from '@/components/admin/role-editor';

describe('validateRoleName', () => {
  it('returns error for empty name', () => {
    expect(validateRoleName('')).toBe('Name is required');
    expect(validateRoleName('   ')).toBe('Name is required');
  });

  it('returns error for name not starting with ROLE_', () => {
    expect(validateRoleName('ADMIN')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
    expect(validateRoleName('role_admin')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
  });

  it('returns error for name with lowercase letters', () => {
    expect(validateRoleName('ROLE_admin')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
    expect(validateRoleName('ROLE_Admin')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
  });

  it('returns error for name with invalid characters', () => {
    expect(validateRoleName('ROLE_ADMIN-USER')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
    expect(validateRoleName('ROLE_ADMIN USER')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
    expect(validateRoleName('ROLE_ADMIN.USER')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
  });

  it('returns error for ROLE_ followed by underscore or number', () => {
    expect(validateRoleName('ROLE__ADMIN')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
    expect(validateRoleName('ROLE_123')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
  });

  it('returns error for single character after ROLE_', () => {
    expect(validateRoleName('ROLE_A')).toBe(
      'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)'
    );
  });

  it('returns null for valid role names', () => {
    expect(validateRoleName('ROLE_ADMIN')).toBeNull();
    expect(validateRoleName('ROLE_USER')).toBeNull();
    expect(validateRoleName('ROLE_MODERATOR')).toBeNull();
    expect(validateRoleName('ROLE_SUPER_ADMIN')).toBeNull();
    expect(validateRoleName('ROLE_LEVEL2_USER')).toBeNull();
    expect(validateRoleName('ROLE_A1')).toBeNull();
    expect(validateRoleName('ROLE_TEST_123')).toBeNull();
  });
});

describe('isDescendantOf', () => {
  const roles = [
    {
      id: '1',
      name: 'ROLE_ADMIN',
      description: null,
      parentId: null,
      parentName: null,
      isSystem: true,
    },
    {
      id: '2',
      name: 'ROLE_MODERATOR',
      description: null,
      parentId: '1',
      parentName: 'ROLE_ADMIN',
      isSystem: true,
    },
    {
      id: '3',
      name: 'ROLE_USER',
      description: null,
      parentId: '2',
      parentName: 'ROLE_MODERATOR',
      isSystem: true,
    },
    {
      id: '4',
      name: 'ROLE_GUEST',
      description: null,
      parentId: null,
      parentName: null,
      isSystem: false,
    },
  ];

  it('returns false for root roles', () => {
    expect(isDescendantOf('1', '1', roles)).toBe(false);
    expect(isDescendantOf('4', '1', roles)).toBe(false);
    expect(isDescendantOf('4', '2', roles)).toBe(false);
  });

  it('returns true for direct children', () => {
    expect(isDescendantOf('2', '1', roles)).toBe(true);
    expect(isDescendantOf('3', '2', roles)).toBe(true);
  });

  it('returns true for indirect descendants', () => {
    expect(isDescendantOf('3', '1', roles)).toBe(true);
  });

  it('returns false when target is not a descendant', () => {
    expect(isDescendantOf('1', '2', roles)).toBe(false);
    expect(isDescendantOf('1', '3', roles)).toBe(false);
    expect(isDescendantOf('2', '3', roles)).toBe(false);
  });

  it('returns false for non-existent role ids', () => {
    expect(isDescendantOf('999', '1', roles)).toBe(false);
    expect(isDescendantOf('1', '999', roles)).toBe(false);
  });

  it('handles empty roles array', () => {
    expect(isDescendantOf('1', '2', [])).toBe(false);
  });

  it('handles single role', () => {
    const singleRole = [
      {
        id: '1',
        name: 'ROLE_ADMIN',
        description: null,
        parentId: null,
        parentName: null,
        isSystem: true,
      },
    ];
    expect(isDescendantOf('1', '1', singleRole)).toBe(false);
  });

  it('handles orphaned roles (parent not in list)', () => {
    const orphanedRoles = [
      {
        id: '5',
        name: 'ROLE_ORPHAN',
        description: null,
        parentId: '999',
        parentName: null,
        isSystem: false,
      },
    ];
    // Orphan with parentId '999' is still considered a descendant of '999'
    // even though '999' doesn't exist in the list
    expect(isDescendantOf('5', '999', orphanedRoles)).toBe(true);
  });

  it('returns false when checking descendant of missing ancestor', () => {
    const orphanedRoles = [
      {
        id: '5',
        name: 'ROLE_ORPHAN',
        description: null,
        parentId: '999',
        parentName: null,
        isSystem: false,
      },
    ];
    // '5' is not a descendant of '1' (unrelated)
    expect(isDescendantOf('5', '1', orphanedRoles)).toBe(false);
  });
});
