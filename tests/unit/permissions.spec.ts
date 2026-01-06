import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  ORGANIZATION_PERMISSIONS,
  USER_PERMISSIONS,
  isOrganizationPermission,
  isUserPermission,
  isPermission,
  type Permission,
  type OrganizationPermission,
  type UserPermission,
} from '@/lib/security/permissions';

describe('Permission Registry', () => {
  describe('PERMISSIONS constant', () => {
    it('should define all organization permissions', () => {
      expect(PERMISSIONS.ORGANIZATION.VIEW).toBe('organization.view');
      expect(PERMISSIONS.ORGANIZATION.EDIT).toBe('organization.edit');
      expect(PERMISSIONS.ORGANIZATION.MANAGE).toBe('organization.manage');
      expect(PERMISSIONS.ORGANIZATION.DELETE).toBe('organization.delete');
      expect(PERMISSIONS.ORGANIZATION.MEMBERS.VIEW).toBe(
        'organization.members.view'
      );
      expect(PERMISSIONS.ORGANIZATION.MEMBERS.MANAGE).toBe(
        'organization.members.manage'
      );
      expect(PERMISSIONS.ORGANIZATION.INVITES.MANAGE).toBe(
        'organization.invites.manage'
      );
    });

    it('should define all user permissions', () => {
      expect(PERMISSIONS.USER.VIEW).toBe('user.view');
      expect(PERMISSIONS.USER.EDIT).toBe('user.edit');
      expect(PERMISSIONS.USER.DELETE).toBe('user.delete');
      expect(PERMISSIONS.USER.ROLES.MANAGE).toBe('user.roles.manage');
    });
  });

  describe('ORGANIZATION_PERMISSIONS array', () => {
    it('should contain all 7 organization permissions', () => {
      expect(ORGANIZATION_PERMISSIONS).toHaveLength(7);
    });

    it('should match all values from PERMISSIONS.ORGANIZATION', () => {
      expect(ORGANIZATION_PERMISSIONS).toContain(PERMISSIONS.ORGANIZATION.VIEW);
      expect(ORGANIZATION_PERMISSIONS).toContain(PERMISSIONS.ORGANIZATION.EDIT);
      expect(ORGANIZATION_PERMISSIONS).toContain(
        PERMISSIONS.ORGANIZATION.MANAGE
      );
      expect(ORGANIZATION_PERMISSIONS).toContain(
        PERMISSIONS.ORGANIZATION.DELETE
      );
      expect(ORGANIZATION_PERMISSIONS).toContain(
        PERMISSIONS.ORGANIZATION.MEMBERS.VIEW
      );
      expect(ORGANIZATION_PERMISSIONS).toContain(
        PERMISSIONS.ORGANIZATION.MEMBERS.MANAGE
      );
      expect(ORGANIZATION_PERMISSIONS).toContain(
        PERMISSIONS.ORGANIZATION.INVITES.MANAGE
      );
    });

    it('should not contain user permissions', () => {
      expect(ORGANIZATION_PERMISSIONS).not.toContain(PERMISSIONS.USER.VIEW);
      expect(ORGANIZATION_PERMISSIONS).not.toContain(PERMISSIONS.USER.EDIT);
    });
  });

  describe('USER_PERMISSIONS array', () => {
    it('should contain all 4 user permissions', () => {
      expect(USER_PERMISSIONS).toHaveLength(4);
    });

    it('should match all values from PERMISSIONS.USER', () => {
      expect(USER_PERMISSIONS).toContain(PERMISSIONS.USER.VIEW);
      expect(USER_PERMISSIONS).toContain(PERMISSIONS.USER.EDIT);
      expect(USER_PERMISSIONS).toContain(PERMISSIONS.USER.DELETE);
      expect(USER_PERMISSIONS).toContain(PERMISSIONS.USER.ROLES.MANAGE);
    });

    it('should not contain organization permissions', () => {
      expect(USER_PERMISSIONS).not.toContain(PERMISSIONS.ORGANIZATION.VIEW);
      expect(USER_PERMISSIONS).not.toContain(PERMISSIONS.ORGANIZATION.EDIT);
    });
  });

  describe('Type inference', () => {
    it('should allow Permission type to accept valid permission strings', () => {
      // These should compile without errors
      const orgView: Permission = 'organization.view';
      const userEdit: Permission = 'user.edit';
      expect(orgView).toBe(PERMISSIONS.ORGANIZATION.VIEW);
      expect(userEdit).toBe(PERMISSIONS.USER.EDIT);
    });

    it('should allow OrganizationPermission type for org permissions', () => {
      const perm: OrganizationPermission = 'organization.members.manage';
      expect(ORGANIZATION_PERMISSIONS).toContain(perm);
    });

    it('should allow UserPermission type for user permissions', () => {
      const perm: UserPermission = 'user.roles.manage';
      expect(USER_PERMISSIONS).toContain(perm);
    });
  });

  describe('Array.includes() compatibility', () => {
    it('should work with ORGANIZATION_PERMISSIONS.includes()', () => {
      expect(
        ORGANIZATION_PERMISSIONS.includes(
          'organization.view' as OrganizationPermission
        )
      ).toBe(true);
      expect(
        ORGANIZATION_PERMISSIONS.includes(
          'invalid.permission' as OrganizationPermission
        )
      ).toBe(false);
    });

    it('should work with USER_PERMISSIONS.includes()', () => {
      expect(
        USER_PERMISSIONS.includes('user.delete' as UserPermission)
      ).toBe(true);
      expect(
        USER_PERMISSIONS.includes('invalid.permission' as UserPermission)
      ).toBe(false);
    });
  });

  describe('Type guard functions', () => {
    describe('isOrganizationPermission()', () => {
      it('should return true for valid organization permissions', () => {
        expect(isOrganizationPermission('organization.view')).toBe(true);
        expect(isOrganizationPermission('organization.edit')).toBe(true);
        expect(isOrganizationPermission('organization.members.manage')).toBe(
          true
        );
      });

      it('should return false for user permissions', () => {
        expect(isOrganizationPermission('user.view')).toBe(false);
        expect(isOrganizationPermission('user.edit')).toBe(false);
      });

      it('should return false for invalid strings', () => {
        expect(isOrganizationPermission('invalid')).toBe(false);
        expect(isOrganizationPermission('')).toBe(false);
        expect(isOrganizationPermission('ROLE_ADMIN')).toBe(false);
      });
    });

    describe('isUserPermission()', () => {
      it('should return true for valid user permissions', () => {
        expect(isUserPermission('user.view')).toBe(true);
        expect(isUserPermission('user.edit')).toBe(true);
        expect(isUserPermission('user.roles.manage')).toBe(true);
      });

      it('should return false for organization permissions', () => {
        expect(isUserPermission('organization.view')).toBe(false);
        expect(isUserPermission('organization.edit')).toBe(false);
      });

      it('should return false for invalid strings', () => {
        expect(isUserPermission('invalid')).toBe(false);
        expect(isUserPermission('')).toBe(false);
        expect(isUserPermission('ROLE_USER')).toBe(false);
      });
    });

    describe('isPermission()', () => {
      it('should return true for any valid permission', () => {
        expect(isPermission('organization.view')).toBe(true);
        expect(isPermission('user.view')).toBe(true);
        expect(isPermission('organization.members.manage')).toBe(true);
        expect(isPermission('user.roles.manage')).toBe(true);
      });

      it('should return false for invalid strings', () => {
        expect(isPermission('invalid')).toBe(false);
        expect(isPermission('')).toBe(false);
        expect(isPermission('ROLE_ADMIN')).toBe(false);
      });
    });
  });
});
