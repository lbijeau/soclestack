# Library Directory

## Purpose

Core utility libraries that provide essential functionality across the application. This directory contains reusable modules for authentication, database access, security, and validation.

## Contents

### `auth.ts`

**Purpose**: Comprehensive authentication and session management system

- **Core Functions**: Session handling, user authentication, token management
- **Features**:
  - Iron-session based session management
  - JWT access/refresh token system
  - Role-based authorization with hierarchical permissions (USER → MODERATOR → ADMIN)
  - Multi-device session management
  - Rate limiting functionality
  - IP address extraction and tracking
- **Key Exports**: `getSession()`, `authenticateUser()`, `createUserSession()`, `hasRequiredRole()`

### `db.ts`

**Purpose**: Database connection and Prisma client configuration

- Centralized database access point
- Prisma client initialization with proper configuration
- Connection pooling and error handling

### `security.ts`

**Purpose**: Cryptographic operations and security utilities

- Password hashing with bcrypt
- JWT token generation and verification (access & refresh tokens)
- Session token generation and hashing
- Security-focused random token generation
- CSRF protection utilities

### `security-headers.ts`

**Purpose**: HTTP security headers configuration

- Content Security Policy (CSP) configuration
- Security headers middleware for Next.js
- XSS protection and clickjacking prevention
- HTTPS enforcement and HSTS headers

### `validations.ts`

**Purpose**: Input validation schemas and utilities using [Zod](https://zod.dev/)

All schemas export TypeScript types via `z.infer<>` for type-safe usage.

#### Authentication Schemas

| Schema | Fields | Description |
|--------|--------|-------------|
| `loginSchema` | `email`, `password`, `rememberMe?` | User login validation |
| `registerSchema` | `email`, `username?`, `password`, `confirmPassword`, `firstName?`, `lastName?`, `organizationName?`, `inviteToken?` | New user registration with organization logic |

**Registration Rules:**
- Password: min 8 chars, requires uppercase, lowercase, number, and special character (`@$!%*?&`)
- Username: 3-20 chars, alphanumeric and underscores only
- Organization: must provide either `organizationName` (create new) OR `inviteToken` (join existing) — not both, not neither

#### Profile Schemas

| Schema | Fields | Description |
|--------|--------|-------------|
| `updateProfileSchema` | `username?`, `firstName?`, `lastName?`, `email?` | Profile updates |
| `changePasswordSchema` | `currentPassword`, `newPassword`, `confirmPassword` | Password change with confirmation |

#### User Management Schemas (Admin)

| Schema | Fields | Description |
|--------|--------|-------------|
| `userListParamsSchema` | `page`, `limit`, `search?`, `role?`, `isActive?`, `sortBy`, `sortOrder` | User list query params |
| `updateUserRoleSchema` | `role` | Change user role (`USER`, `MODERATOR`, `ADMIN`) |
| `updateUserStatusSchema` | `isActive` | Activate/deactivate user |

#### Password Reset Schemas

| Schema | Fields | Description |
|--------|--------|-------------|
| `requestPasswordResetSchema` | `email` | Request password reset email |
| `resetPasswordSchema` | `token`, `password`, `confirmPassword` | Reset with token validation |

#### API Key Schemas

| Schema | Fields | Description |
|--------|--------|-------------|
| `createApiKeySchema` | `name`, `permission?`, `expiresAt?` | Create new API key |
| `updateApiKeySchema` | `name?`, `permission?`, `expiresAt?` | Update existing key |

**API Key Rules:**
- Name: 1-50 characters, required
- Permission: `READ_ONLY` (default) or `READ_WRITE`
- Expiration: optional, must be future date if provided

#### Exported Types

```typescript
type LoginInput = z.infer<typeof loginSchema>;
type RegisterInput = z.infer<typeof registerSchema>;
type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
type UserListParams = z.infer<typeof userListParamsSchema>;
type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
```

## Usage

### Authentication Flow

```typescript
import { authenticateUser, createUserSession } from '@/lib/auth';

// Authenticate user
const user = await authenticateUser(email, password);
if (user) {
  const tokens = await createUserSession(user, ipAddress, userAgent);
  // Handle successful login
}
```

### Session Management

```typescript
import { getCurrentUser, getSession } from '@/lib/auth';

// Get current user from session
const user = await getCurrentUser();

// Check user permissions
if (hasRequiredRole(user.role, 'ADMIN')) {
  // Allow admin operation
}
```

### Database Access

```typescript
import { prisma } from '@/lib/db';

// Use Prisma client
const users = await prisma.user.findMany();
```

### Validation

```typescript
import { loginSchema, registerSchema, type LoginInput } from '@/lib/validations';

// Validate form data with error handling
const result = loginSchema.safeParse(formData);
if (result.success) {
  const data: LoginInput = result.data;
  // Process valid data
} else {
  // Handle validation errors
  const errors = result.error.flatten().fieldErrors;
  // { email?: string[], password?: string[] }
}

// In API route handlers
export async function POST(request: Request) {
  const body = await request.json();
  const result = registerSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  // result.data is fully typed
  const { email, password, organizationName } = result.data;
}
```

## Dependencies

- **Prisma**: Database ORM and client
- **iron-session**: Secure session management
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT token operations
- **zod**: Runtime type checking and validation
- **crypto**: Node.js cryptographic functions

## Architecture Notes

- **Session Strategy**: Hybrid approach using iron-session for browser sessions + JWT tokens for API access
- **Security**: Multiple layers including rate limiting, CSRF protection, and secure headers
- **Role System**: Hierarchical permissions with three levels (USER, MODERATOR, ADMIN)
- **Token Management**: Separate access (short-lived) and refresh (long-lived) tokens
- **Multi-device**: Session tracking with IP and user agent for security monitoring

## Configuration Requirements

Required environment variables:

- `SESSION_SECRET`: Secret for iron-session encryption
- `JWT_SECRET`: Secret for JWT token signing
- `DATABASE_URL`: Prisma database connection string

## Related Documentation

- [Auth Components](../components/auth/README.md) - Authentication UI components
- [Profile Components](../components/profile/README.md) - Profile management components
- [Login API Route](../app/api/auth/login/README.md) - Login endpoint
- [Register API Route](../app/api/auth/register/README.md) - Registration endpoint
- [API Keys Routes](../app/api/keys/README.md) - API key management
- [Organization Pages](../app/organization/README.md) - Multi-tenant management
- [API Examples](../../docs/API_EXAMPLES.md) - API usage patterns
- [Technical Architecture](../../docs/TECHNICAL_ARCHITECTURE.md) - System design
- [Environment Variables](../../docs/ENVIRONMENT.md) - Configuration reference
