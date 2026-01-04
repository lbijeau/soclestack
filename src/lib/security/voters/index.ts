/**
 * Voter implementations for the security system
 */

import type { Voter } from '../voter';
import { organizationVoter } from './organization-voter';
import { userVoter } from './user-voter';

export { OrganizationVoter, organizationVoter } from './organization-voter';
export { UserVoter, userVoter } from './user-voter';

/**
 * Registry of all security voters
 *
 * Voters are checked in order. The first voter that supports the attribute
 * will vote on the permission. With affirmative strategy, first GRANTED wins.
 */
export const voters: Voter[] = [organizationVoter, userVoter];
