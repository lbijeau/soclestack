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

**Purpose**: Input validation schemas and utilities

- Zod-based validation schemas
- User registration and login validation
- Email format validation
- Password strength requirements
- Form data sanitization

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
import { loginSchema, registerSchema } from '@/lib/validations';

// Validate form data
const result = loginSchema.safeParse(formData);
if (result.success) {
  // Process valid data
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
