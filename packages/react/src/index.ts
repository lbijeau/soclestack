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
