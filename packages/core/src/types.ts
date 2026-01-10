/**
 * User object returned from SocleStack API
 */
export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  createdAt: string;
  /** Global roles assigned to the user */
  roles?: string[];
}

/**
 * Organization object
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  /** User's role within this organization */
  role?: 'ROLE_OWNER' | 'ROLE_ADMIN' | 'ROLE_MEMBER';
}

/**
 * Authentication state machine states
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User; organization?: Organization }
  | { status: 'error'; error: Error };

/**
 * Login result from API
 */
export type LoginResult =
  | { success: true; user: User }
  | { success: false; error: string }
  | { success: false; requires2FA: true; tempToken: string };

/**
 * Register data for new user
 */
export interface RegisterData {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Register result from API
 */
export type RegisterResult =
  | { success: true; user: User }
  | { success: false; error: string };

/**
 * Token storage interface for custom implementations
 */
export interface TokenStorage {
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string | null): void;
  clear(): void;
}

/**
 * Client configuration options
 */
export interface SocleClientOptions {
  /** Base URL of your SocleStack instance */
  baseUrl: string;
  /** Redirect URI for OAuth-style flows */
  redirectUri?: string;
  /** Custom token storage implementation */
  tokenStorage?: TokenStorage;
  /** Include credentials for cross-origin requests */
  credentials?: 'include' | 'same-origin' | 'omit';
}

/**
 * Event types emitted by the client
 */
export type SocleEvent =
  | { type: 'stateChange'; state: AuthState }
  | { type: 'tokenRefresh' }
  | { type: 'logout' }
  | { type: 'error'; error: Error };

/**
 * Unsubscribe function returned by subscribe
 */
export type Unsubscribe = () => void;

/**
 * Organization invite object
 */
export interface Invite {
  id: string;
  organizationId: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  role: 'ROLE_ADMIN' | 'ROLE_MEMBER';
  email: string;
  expiresAt: string;
}

/**
 * Status of an invite token
 */
export type InviteStatus =
  | 'loading'
  | 'valid'
  | 'expired'
  | 'invalid'
  | 'already_used'
  | 'already_member';

/**
 * Result from fetching an invite
 */
export interface InviteResult {
  success: boolean;
  invite?: Invite;
  error?: string;
  status?: InviteStatus;
}

/**
 * Result from accepting an invite
 */
export interface AcceptInviteResult {
  success: boolean;
  organization?: Organization;
  error?: string;
}
