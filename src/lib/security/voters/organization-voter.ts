/**
 * OrganizationVoter - handles authorization for organization-related actions
 *
 * Checks user's organization membership and role to determine access.
 */

import type { OrganizationRole } from '@prisma/client';
import type { Voter } from '../voter';
import { VoteResult } from '../voter';
import type { UserWithRoles } from '../index';
import { hasOrgRole } from '@/lib/organization';
import { hasRole } from '../index';

/**
 * Supported organization permission attributes
 */
const ATTRIBUTES = [
  'organization.view',
  'organization.edit',
  'organization.manage',
  'organization.delete',
  'organization.members.view',
  'organization.members.manage',
  'organization.invites.manage',
] as const;

type OrgAttribute = (typeof ATTRIBUTES)[number];

/**
 * Minimum role required for each permission
 */
const REQUIRED_ROLES: Record<OrgAttribute, OrganizationRole> = {
  'organization.view': 'MEMBER',
  'organization.edit': 'ADMIN',
  'organization.manage': 'ADMIN',
  'organization.delete': 'OWNER',
  'organization.members.view': 'MEMBER',
  'organization.members.manage': 'ADMIN',
  'organization.invites.manage': 'ADMIN',
};

/**
 * Minimal organization shape for type checking
 */
interface OrganizationSubject {
  id: string;
  slug: string;
}

/**
 * Extended user type with organization fields
 */
interface UserWithOrganization extends UserWithRoles {
  organizationId?: string | null;
  organizationRole?: OrganizationRole;
}

export class OrganizationVoter implements Voter {
  /**
   * Check if this voter handles the given attribute and subject
   */
  supports(attribute: string, subject?: unknown): boolean {
    return (
      ATTRIBUTES.includes(attribute as OrgAttribute) &&
      this.isOrganization(subject)
    );
  }

  /**
   * Vote on whether the user has the requested permission
   */
  async vote(
    user: UserWithRoles,
    attribute: string,
    subject?: unknown
  ): Promise<VoteResult> {
    const org = subject as OrganizationSubject;
    const userWithOrg = user as UserWithOrganization;

    // Platform admins (ROLE_ADMIN with null org context) can manage any organization
    const isPlatformAdmin = await hasRole(user, 'ROLE_ADMIN', null);
    if (isPlatformAdmin) {
      // Platform admins can manage and delete, but not necessarily view member details
      // unless they're explicitly checking those permissions
      const requiredRole = REQUIRED_ROLES[attribute as OrgAttribute];
      if (requiredRole && ['ADMIN', 'OWNER'].includes(requiredRole)) {
        return VoteResult.GRANTED;
      }
    }

    // Must be member of this specific organization
    if (userWithOrg.organizationId !== org.id) {
      return VoteResult.DENIED;
    }

    // Must have an organization role
    if (!userWithOrg.organizationRole) {
      return VoteResult.DENIED;
    }

    const requiredRole = REQUIRED_ROLES[attribute as OrgAttribute];
    if (!requiredRole) {
      return VoteResult.ABSTAIN;
    }

    return hasOrgRole(userWithOrg.organizationRole, requiredRole)
      ? VoteResult.GRANTED
      : VoteResult.DENIED;
  }

  /**
   * Type guard to check if subject is an Organization
   */
  private isOrganization(subject: unknown): subject is OrganizationSubject {
    return (
      typeof subject === 'object' &&
      subject !== null &&
      'id' in subject &&
      'slug' in subject
    );
  }
}

/**
 * Singleton instance for use with voter registry
 */
export const organizationVoter = new OrganizationVoter();
