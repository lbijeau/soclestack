import { useSocleContext } from './provider';
import type { User, Organization } from '@soclestack/core';

/**
 * Main auth hook - provides state and auth methods
 */
export function useAuth() {
  const { state, login, logout, register, verify2FA } = useSocleContext();

  return {
    state,
    isLoading: state.status === 'loading',
    isAuthenticated: state.status === 'authenticated',
    login,
    logout,
    register,
    verify2FA,
  };
}

/**
 * Get current user (null if not authenticated)
 */
export function useUser(): User | null {
  const { state } = useSocleContext();
  return state.status === 'authenticated' ? state.user : null;
}

/**
 * Get current organization (null if none selected)
 */
export function useOrganization(): Organization | null {
  const { state } = useSocleContext();
  return state.status === 'authenticated' ? state.organization ?? null : null;
}

/**
 * Check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { state } = useSocleContext();
  return state.status === 'authenticated';
}
