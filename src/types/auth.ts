import { User, OrganizationRole } from '@prisma/client';

/**
 * Platform role names (stored in roles table)
 * ROLE_ADMIN inherits from ROLE_MODERATOR inherits from ROLE_USER
 *
 * Uses template literal type to support arbitrary database-driven roles.
 * Role names must follow the pattern: ROLE_[A-Z][A-Z0-9_]*
 */
export type PlatformRole = `ROLE_${string}`;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username?: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  role: PlatformRole;
  iat: number;
  exp: number;
  jti: string; // unique token identifier
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthError {
  type:
    | 'VALIDATION_ERROR'
    | 'AUTHENTICATION_ERROR'
    | 'AUTHORIZATION_ERROR'
    | 'NOT_FOUND'
    | 'SERVER_ERROR'
    | 'ACCOUNT_LOCKED'
    | 'RATE_LIMIT_ERROR';
  message: string;
  details?: Record<string, string[]>;
  lockedUntil?: string;
  retryAfterSeconds?: number;
}

export interface ImpersonationData {
  originalUserId: string;
  originalEmail: string;
  originalRole: PlatformRole;
  startedAt: number; // Unix timestamp
}

export interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
}

export interface SessionData {
  userId: string;
  email: string;
  role: PlatformRole;
  isLoggedIn: boolean;
  sessionCreatedAt?: number; // Unix timestamp for session expiry tracking
  impersonating?: ImpersonationData;
  organization?: OrganizationData;
}
