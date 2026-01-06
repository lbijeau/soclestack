/**
 * UserVoter - handles authorization for user management actions
 *
 * Supports self-access for view/edit, and role-based access for admin operations.
 *
 * @note This voter uses a loose type guard (any object with `id`) intentionally.
 * The voter registry routes requests to the correct voter based on attribute prefix,
 * so OrganizationVoter handles `organization.*` and UserVoter handles `user.*`.
 *
 * @todo ROLES.MODERATOR is hardcoded. When dynamic roles are implemented (see #183),
 * this voter will need to be refactored to use a configurable permission mapping
 * or query role capabilities from the database.
 */

import type { Voter } from '../voter';
import { VoteResult } from '../voter';
import type { UserWithRoles } from '../role-checker';
import { hasRole } from '../role-checker';
import { ROLE_NAMES as ROLES } from '@/lib/constants/roles';

/**
 * Supported user permission attributes
 */
const ATTRIBUTES = [
  'user.view',
  'user.edit',
  'user.delete',
  'user.roles.manage',
] as const;

type UserAttribute = (typeof ATTRIBUTES)[number];

/**
 * Minimal user shape for type checking
 */
interface UserSubject {
  id: string;
}

export class UserVoter implements Voter {
  /**
   * Check if this voter handles the given attribute and subject
   */
  supports(attribute: string, subject?: unknown): boolean {
    return (
      ATTRIBUTES.includes(attribute as UserAttribute) && this.isUser(subject)
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
    const targetUser = subject as UserSubject;

    // Self-access checks
    if (user.id === targetUser.id) {
      // Users can view and edit themselves
      if (attribute === 'user.view' || attribute === 'user.edit') {
        return VoteResult.GRANTED;
      }
      // Users cannot delete themselves or manage their own roles
      return VoteResult.DENIED;
    }

    // ADMIN can perform all actions on other users
    if (await hasRole(user, ROLES.ADMIN)) {
      return VoteResult.GRANTED;
    }

    // MODERATOR can view/edit other users but not delete or manage roles
    // TODO: Hardcoded role - see #183 for dynamic role architecture
    if (await hasRole(user, ROLES.MODERATOR)) {
      if (attribute === 'user.view' || attribute === 'user.edit') {
        return VoteResult.GRANTED;
      }
    }

    return VoteResult.DENIED;
  }

  /**
   * Type guard to check if subject is a User
   */
  private isUser(subject: unknown): subject is UserSubject {
    return typeof subject === 'object' && subject !== null && 'id' in subject;
  }
}

/**
 * Singleton instance for use with voter registry
 */
export const userVoter = new UserVoter();
