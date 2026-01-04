/**
 * Voter System - Symfony-style permission voting
 *
 * Voters provide fine-grained, contextual authorization checks.
 * Each voter handles specific permission types and can GRANT, DENY, or ABSTAIN.
 *
 * The voting strategy (affirmative by default) determines how votes combine:
 * - AFFIRMATIVE: First GRANTED wins
 * - CONSENSUS: Majority wins
 * - UNANIMOUS: All must GRANT
 */

import type { UserWithRoles } from './index';

/**
 * Result of a voter's decision
 */
export enum VoteResult {
  /** Permission granted - stops voting in affirmative strategy */
  GRANTED = 'granted',
  /** Permission denied - counted in consensus/unanimous strategies */
  DENIED = 'denied',
  /** Voter doesn't handle this attribute/subject - skipped */
  ABSTAIN = 'abstain',
}

/**
 * Voter interface - implement to add custom permission checks
 *
 * @example
 * ```typescript
 * class OrganizationVoter implements Voter {
 *   supports(attribute: string, subject?: unknown): boolean {
 *     return attribute.startsWith('organization.') && subject instanceof Organization;
 *   }
 *
 *   async vote(user: UserWithRoles, attribute: string, subject?: unknown): Promise<VoteResult> {
 *     const org = subject as Organization;
 *     if (attribute === 'organization.edit' && org.ownerId === user.id) {
 *       return VoteResult.GRANTED;
 *     }
 *     return VoteResult.DENIED;
 *   }
 * }
 * ```
 */
export interface Voter {
  /**
   * Check if this voter can handle the given attribute and subject.
   *
   * @param attribute - Permission being checked (e.g., 'organization.edit', 'user.delete')
   * @param subject - Optional context object (e.g., the organization or user being accessed)
   * @returns true if this voter should vote on this permission
   */
  supports(attribute: string, subject?: unknown): boolean;

  /**
   * Vote on whether the user has the requested permission.
   *
   * Only called if supports() returns true.
   *
   * @param user - The user requesting permission (includes roles)
   * @param attribute - Permission being checked
   * @param subject - Optional context object
   * @returns GRANTED, DENIED, or ABSTAIN
   */
  vote(
    user: UserWithRoles,
    attribute: string,
    subject?: unknown
  ): Promise<VoteResult>;
}

/**
 * Voting strategy determines how multiple voter results combine
 */
export enum VotingStrategy {
  /** First GRANTED wins (default, most permissive) */
  AFFIRMATIVE = 'affirmative',
  /** More GRANTEDs than DENIEDs wins */
  CONSENSUS = 'consensus',
  /** All voters must GRANT (most restrictive) */
  UNANIMOUS = 'unanimous',
}
