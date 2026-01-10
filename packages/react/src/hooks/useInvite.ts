import { useState, useEffect, useCallback } from 'react';
import { useSocleContext } from '../provider';
import type { Invite, InviteStatus, Organization } from '@soclestack/core';

/**
 * Hook for handling organization invite tokens
 *
 * @example
 * ```tsx
 * const { invite, status, accept, isAccepting } = useInvite(token);
 *
 * if (status === 'valid' && invite) {
 *   return (
 *     <div>
 *       <p>Join {invite.organizationName}</p>
 *       <button onClick={accept}>Accept</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useInvite(token: string) {
  const { client, state } = useSocleContext();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const isAuthenticated = state.status === 'authenticated';

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setError('No invite token provided');
      return;
    }

    setStatus('loading');
    setError(null);

    client.rawApi
      .getInvite(token)
      .then((result) => {
        if (result.success && result.invite) {
          setInvite(result.invite);
          setStatus('valid');
        } else {
          setError(result.error ?? 'Invalid invite');
          setStatus(result.status ?? 'invalid');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Network error');
        setStatus('invalid');
      });
  }, [client, token]);

  const accept = useCallback(async (): Promise<Organization | null> => {
    if (!isAuthenticated) {
      setError('You must be logged in to accept an invite');
      return null;
    }

    setIsAccepting(true);
    setError(null);

    try {
      const result = await client.rawApi.acceptInvite(token);
      if (result.success && result.organization) {
        return result.organization;
      }
      setError(result.error ?? 'Failed to accept invite');
      return null;
    } finally {
      setIsAccepting(false);
    }
  }, [client, token, isAuthenticated]);

  return {
    /** The invite details if valid */
    invite,
    /** Current status of the invite */
    status,
    /** Error message if any */
    error,
    /** Whether the invite is being loaded */
    isLoading: status === 'loading',
    /** Whether the invite is being accepted */
    isAccepting,
    /** Whether the user is authenticated */
    isAuthenticated,
    /** Accept the invite and join the organization */
    accept,
  };
}
