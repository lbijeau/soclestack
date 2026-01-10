import { useEffect } from 'react';
import { useAuth } from '../hooks';

export interface UseAuthRedirectOptions {
  /** Path to redirect to when unauthenticated */
  loginPath?: string;
  /** Custom redirect function (framework-agnostic) */
  onRedirect?: (url: string) => void;
  /** Whether to include return URL in redirect */
  includeReturnUrl?: boolean;
}

/**
 * Hook for handling auth redirects
 *
 * @example
 * ```tsx
 * // With Next.js App Router
 * const router = useRouter();
 * useAuthRedirect({
 *   loginPath: '/login',
 *   onRedirect: (url) => router.push(url),
 * });
 *
 * // With React Router
 * const navigate = useNavigate();
 * useAuthRedirect({
 *   onRedirect: (url) => navigate(url),
 * });
 * ```
 */
export function useAuthRedirect({
  loginPath = '/login',
  onRedirect,
  includeReturnUrl = true,
}: UseAuthRedirectOptions = {}) {
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'unauthenticated' && onRedirect) {
      let redirectUrl = loginPath;

      if (includeReturnUrl && typeof window !== 'undefined') {
        const currentPath = window.location.pathname + window.location.search;
        const returnUrl = encodeURIComponent(currentPath);
        redirectUrl = `${loginPath}?returnUrl=${returnUrl}`;
      }

      onRedirect(redirectUrl);
    }
  }, [state.status, loginPath, onRedirect, includeReturnUrl]);

  return {
    status: state.status,
    isLoading: state.status === 'loading',
    isAuthenticated: state.status === 'authenticated',
  };
}
