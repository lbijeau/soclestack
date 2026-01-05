/**
 * OrganizationVoter - handles authorization for organization-related actions
 *
 * Checks user's organization membership and role to determine access.
 */

import type { Voter } from '../voter';
import { VoteResult } from '../voter';
import type { UserWithRoles } from '../index';
import { hasRole, ROLES } from '../index';

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
 * Using ROLE_* constants instead of old OrganizationRole enum
 */
const REQUIRED_ROLES: Record<OrgAttribute, string> = {
  'organization.view': ROLES.USER, // Any member
  'organization.edit': ROLES.ADMIN,
  'organization.manage': ROLES.ADMIN,
  'organization.delete': ROLES.OWNER,
  'organization.members.view': ROLES.USER, // Any member
  'organization.members.manage': ROLES.ADMIN,
  'organization.invites.manage': ROLES.ADMIN,
};

/**
 * Minimal organization shape for type checking
 */
interface OrganizationSubject {
  id: string;
  slug: string;
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

    // Platform admins (ROLE_ADMIN with null org context) can manage any organization
    const isPlatformAdmin = await hasRole(user, ROLES.ADMIN, null);
    if (isPlatformAdmin) {
      return VoteResult.GRANTED;
    }

    const requiredRole = REQUIRED_ROLES[attribute as OrgAttribute];
    if (!requiredRole) {
      return VoteResult.ABSTAIN;
    }

    // Check if user has the required role in this specific organization
    const hasRequiredRole = await hasRole(user, requiredRole, org.id);
    return hasRequiredRole ? VoteResult.GRANTED : VoteResult.DENIED;
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
