// Re-export core types
export type {
  User,
  Organization,
  AuthState,
  LoginResult,
  RegisterData,
  RegisterResult,
  SocleClient,
} from '@soclestack/core';

// Provider
export { SocleProvider, useSocleContext } from './provider';
export type { SocleProviderProps } from './provider';

// Hooks
export { useAuth, useUser, useOrganization, useIsAuthenticated } from './hooks';
export { usePermissions } from './hooks/usePermissions';
export type { CanOptions } from './hooks/usePermissions';
export { useAuthRedirect } from './hooks/useAuthRedirect';
export type { UseAuthRedirectOptions } from './hooks/useAuthRedirect';

// Components
export * from './components';
