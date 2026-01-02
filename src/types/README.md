# Types Directory

## Purpose

TypeScript type definitions and interfaces for the application. Provides type safety and contracts for authentication, user management, and API interactions.

## Contents

### `auth.ts`

**Purpose**: Authentication and authorization type definitions

- **Login Types**: `LoginCredentials` for email/password authentication
- **Registration Types**: `RegisterData` with optional profile fields
- **JWT Types**:
  - `JWTPayload` for access tokens (user ID, email, role, expiration)
  - `RefreshTokenPayload` for refresh tokens (simplified payload)
- **State Management**: `AuthState` for client-side authentication state
- **Error Handling**: `AuthError` with structured error types and validation details
- **Session Types**: `SessionData` for iron-session storage

### `user.ts`

**Purpose**: User-related type definitions and enums

- User profile interfaces
- Role definitions and permissions
- User management operations
- Profile update schemas

## Usage

### Authentication Types

```typescript
import { LoginCredentials, AuthError, SessionData } from '@/types/auth';

// Login form data
const credentials: LoginCredentials = {
  email: 'user@example.com',
  password: 'securePassword',
};

// Error handling
const error: AuthError = {
  type: 'VALIDATION_ERROR',
  message: 'Invalid email format',
  details: { email: ['Must be a valid email address'] },
};

// Session data structure
const session: SessionData = {
  userId: 'user-id',
  email: 'user@example.com',
  role: 'USER',
  isLoggedIn: true,
};
```

### JWT Token Handling

```typescript
import { JWTPayload, RefreshTokenPayload } from '@/types/auth';

// Access token payload
const accessPayload: JWTPayload = {
  sub: 'user-id',
  email: 'user@example.com',
  role: 'USER',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  jti: 'unique-token-id',
};

// Refresh token payload (minimal data)
const refreshPayload: RefreshTokenPayload = {
  sub: 'user-id',
  jti: 'unique-token-id',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
};
```

### Form Validation

```typescript
import { RegisterData } from '@/types/auth';

// Registration form with optional fields
const registerData: RegisterData = {
  email: 'user@example.com',
  password: 'securePassword',
  username: 'optional-username',
  firstName: 'John',
  lastName: 'Doe',
};
```

## Dependencies

- **@prisma/client**: Imports Prisma-generated types (`User`, `Role`)
- **Zod**: Runtime validation (referenced in validation schemas)

## Type Safety Features

- **Strict Typing**: All authentication flows are fully typed
- **Error Types**: Structured error handling with specific error categories
- **Role System**: Type-safe role hierarchy and permission checking
- **JWT Standards**: Follows JWT standard claims (sub, iat, exp, jti)
- **Optional Fields**: Flexible user registration with optional profile data

## Integration Points

- **API Routes**: Used in all `/api/auth/*` endpoints for request/response typing
- **Components**: Forms and UI components use these types for props and state
- **Middleware**: Authentication middleware relies on these types
- **Database**: Extends Prisma types with application-specific interfaces
- **Validation**: Works closely with `/lib/validations.ts` schemas

## Error Handling Strategy

The `AuthError` interface provides structured error handling:

- **VALIDATION_ERROR**: Form validation failures with field-specific messages
- **AUTHENTICATION_ERROR**: Login failures (wrong credentials)
- **AUTHORIZATION_ERROR**: Permission denied errors
- **NOT_FOUND**: Resource not found errors
- **SERVER_ERROR**: Internal server errors

## Role Hierarchy

Roles are hierarchical with increasing permissions:

1. **USER**: Basic authenticated user
2. **MODERATOR**: Can moderate content and users
3. **ADMIN**: Full system access and user management
