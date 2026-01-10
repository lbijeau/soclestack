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
}

/**
 * Organization object
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
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
