/**
 * OrganizationVoter - handles authorization for organization-related actions
 *
 * Checks user's organization membership and role to determine access.
 */

import type { Voter } from '../voter';
import { VoteResult } from '../voter';
import type { UserWithRoles } from '../role-checker';
import { hasRole } from '../role-checker';
import { ROLE_NAMES as ROLES } from '@/lib/constants/roles';
import {
  PERMISSIONS,
  isOrganizationPermission,
  type OrganizationPermission,
} from '../permissions';

/**
 * Minimum role required for each permission
 */
const REQUIRED_ROLES: Record<OrganizationPermission, string> = {
  [PERMISSIONS.ORGANIZATION.VIEW]: ROLES.USER,
  [PERMISSIONS.ORGANIZATION.EDIT]: ROLES.ADMIN,
  [PERMISSIONS.ORGANIZATION.MANAGE]: ROLES.ADMIN,
  [PERMISSIONS.ORGANIZATION.DELETE]: ROLES.OWNER,
  [PERMISSIONS.ORGANIZATION.MEMBERS.VIEW]: ROLES.USER,
  [PERMISSIONS.ORGANIZATION.MEMBERS.MANAGE]: ROLES.ADMIN,
  [PERMISSIONS.ORGANIZATION.INVITES.MANAGE]: ROLES.ADMIN,
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
    return isOrganizationPermission(attribute) && this.isOrganization(subject);
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

    // Use type guard to narrow attribute type (supports() already validated this)
    if (!isOrganizationPermission(attribute)) {
      return VoteResult.ABSTAIN;
    }

    const requiredRole = REQUIRED_ROLES[attribute];

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
