import { useState, useEffect, useCallback } from 'react';
import { useSocleContext } from '../provider';
import type { Organization } from '@soclestack/core';

/**
 * Hook for managing organizations - listing, switching, and tracking current org
 *
 * @example
 * ```tsx
 * const { organizations, currentOrganization, switchOrganization } = useOrganizations();
 *
 * // Switch to a different org
 * await switchOrganization(orgId);
 * ```
 */
export function useOrganizations() {
  const { client, state } = useSocleContext();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const currentOrganization =
    state.status === 'authenticated' ? (state.organization ?? null) : null;

  useEffect(() => {
    if (state.status === 'authenticated') {
      setIsLoading(true);
      setError(null);

      client.rawApi
        .getOrganizations()
        .then(setOrganizations)
        .catch((err) => setError(err instanceof Error ? err : new Error('Failed to load organizations')))
        .finally(() => setIsLoading(false));
    } else {
      setOrganizations([]);
      setIsLoading(false);
    }
  }, [client, state.status]);

  const switchOrganization = useCallback(
    async (orgId: string): Promise<Organization | null> => {
      await client.switchOrganization(orgId);
      const org = organizations.find((o) => o.id === orgId);
      return org ?? null;
    },
    [client, organizations]
  );

  const refetch = useCallback(async () => {
    if (state.status !== 'authenticated') return;

    setIsLoading(true);
    setError(null);

    try {
      const orgs = await client.rawApi.getOrganizations();
      setOrganizations(orgs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load organizations'));
    } finally {
      setIsLoading(false);
    }
  }, [client, state.status]);

  return {
    organizations,
    currentOrganization,
    switchOrganization,
    isLoading,
    error,
    refetch,
  };
}
