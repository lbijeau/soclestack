import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocleContext } from '../provider';

export interface UseSessionTimeoutOptions {
  /** Seconds before expiry to trigger warning (default: 300) */
  warnBefore?: number;
  /** How often to check in seconds (default: 30) */
  checkInterval?: number;
  /** Session duration in seconds if not provided by server (default: 3600) */
  sessionDuration?: number;
  /** Called when warning threshold reached */
  onWarning?: () => void;
  /** Called when session expires */
  onTimeout?: () => void;
}

/**
 * Hook for tracking session timeout and extending sessions
 *
 * @example
 * ```tsx
 * const { timeRemaining, isWarning, extend, isExpired } = useSessionTimeout({
 *   warnBefore: 300,
 *   onTimeout: () => router.push('/login?expired=true'),
 * });
 *
 * if (isWarning) {
 *   return <SessionWarningModal onExtend={extend} timeRemaining={timeRemaining} />;
 * }
 * ```
 */
export function useSessionTimeout({
  warnBefore = 300,
  checkInterval = 30,
  sessionDuration = 3600,
  onWarning,
  onTimeout,
}: UseSessionTimeoutOptions = {}) {
  const { client, state } = useSocleContext();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isWarning, setIsWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isExtending, setIsExtending] = useState(false);

  const warningFiredRef = useRef(false);
  const sessionStartRef = useRef<number | null>(null);

  // Track when session started/refreshed
  useEffect(() => {
    if (state.status === 'authenticated') {
      // Reset session start time when authenticated
      if (sessionStartRef.current === null) {
        sessionStartRef.current = Date.now();
      }
    } else {
      sessionStartRef.current = null;
      setTimeRemaining(null);
      setIsWarning(false);
      setIsExpired(false);
      warningFiredRef.current = false;
    }
  }, [state.status]);

  // Calculate remaining time
  const getTimeRemaining = useCallback((): number | null => {
    if (state.status !== 'authenticated' || sessionStartRef.current === null) {
      return null;
    }

    // Check if state has expiresAt (extended AuthState)
    const authenticatedState = state as { expiresAt?: string };
    if (authenticatedState.expiresAt) {
      const expiresAt = new Date(authenticatedState.expiresAt).getTime();
      return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    }

    // Fallback to session duration from start
    const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    return Math.max(0, sessionDuration - elapsed);
  }, [state, sessionDuration]);

  // Periodic check
  useEffect(() => {
    if (state.status !== 'authenticated') {
      return;
    }

    const check = () => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining === null) return;

      if (remaining <= 0) {
        setIsExpired(true);
        setIsWarning(false);
        onTimeout?.();
      } else if (remaining <= warnBefore && !warningFiredRef.current) {
        setIsWarning(true);
        warningFiredRef.current = true;
        onWarning?.();
      }
    };

    // Initial check
    check();

    // Set up interval
    const intervalId = setInterval(check, checkInterval * 1000);

    return () => clearInterval(intervalId);
  }, [state.status, warnBefore, checkInterval, getTimeRemaining, onWarning, onTimeout]);

  // Extend session
  const extend = useCallback(async (): Promise<boolean> => {
    if (state.status !== 'authenticated') {
      return false;
    }

    setIsExtending(true);
    try {
      await client.refreshSession();
      // Reset session tracking on success
      sessionStartRef.current = Date.now();
      setIsWarning(false);
      setIsExpired(false);
      warningFiredRef.current = false;
      return true;
    } catch {
      return false;
    } finally {
      setIsExtending(false);
    }
  }, [client, state.status]);

  return {
    /** Seconds until session expires (null if not authenticated) */
    timeRemaining,
    /** True when within warning threshold */
    isWarning,
    /** True when session has expired */
    isExpired,
    /** Extend the session by refreshing */
    extend,
    /** True while extend is in progress */
    isExtending,
  };
}
