# Login API Route

## Purpose

Handles user authentication and session creation for the login process. Implements secure login with rate limiting, input validation, and comprehensive error handling.

## Contents

### `route.ts`

**HTTP Method**: POST
**Purpose**: Authenticate user credentials and create a new session

## API Specification

### Request

```typescript
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "userPassword"
}
```

### Response (Success - 200)

```typescript
{
  "message": "Login successful",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "username",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "isActive": true,
    "emailVerified": true,
    "lastLoginAt": "2024-01-01T12:00:00Z",
    "createdAt": "2024-01-01T12:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Error Responses

#### Rate Limited (429)

```typescript
{
  "error": {
    "type": "AUTHORIZATION_ERROR",
    "message": "Too many login attempts. Please try again later."
  }
}
```

#### Validation Error (400)

```typescript
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "email": ["Invalid email format"],
      "password": ["Password is required"]
    }
  }
}
```

#### Authentication Failed (401)

```typescript
{
  "error": {
    "type": "AUTHENTICATION_ERROR",
    "message": "Invalid email or password"
  }
}
```

#### Email Not Verified (403)

```typescript
{
  "error": {
    "type": "AUTHORIZATION_ERROR",
    "message": "Please verify your email before logging in"
  }
}
```

## Security Features

### Rate Limiting

- **Limit**: 5 attempts per IP address
- **Window**: 15 minutes
- **Key**: `login:{clientIP}`
- **Purpose**: Prevent brute force attacks

### Input Validation

- **Schema**: Uses `loginSchema` from `/lib/validations`
- **Fields**: Email format and password presence validation
- **Sanitization**: Automatic data cleaning and type checking

### IP Tracking

- **Source**: Extracts real IP from headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP)
- **Purpose**: Rate limiting and security logging
- **Fallback**: Returns 'unknown' if IP cannot be determined

### Session Security

- **Session Creation**: Creates iron-session and database session record
- **Token Generation**: JWT access token (15min) + refresh token (7 days)
- **User Agent Tracking**: Stores user agent for session identification

## Business Logic

### Authentication Flow

1. **Rate Limit Check**: Verify IP hasn't exceeded login attempts
2. **Input Validation**: Validate email format and password presence
3. **User Authentication**: Verify credentials against database
4. **Email Verification Check**: Ensure user has verified their email
5. **Session Creation**: Generate tokens and create session records
6. **Response**: Return user data and authentication tokens

### Error Handling

- **Graceful Failures**: All errors return structured `AuthError` format
- **Security**: Generic error messages to prevent user enumeration
- **Logging**: Server errors logged for debugging while hiding details from client

## Dependencies

- **@/lib/validations**: `loginSchema` for input validation
- **@/lib/auth**: Authentication utilities and session management
- **@/types/auth**: Type definitions for requests and responses
- **Next.js**: Server-side API route handling

## Usage Example

### Client-side Implementation

```typescript
async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error.message);
  }

  return data;
}
```

### Integration Points

- **Login Forms**: Used by `/app/login` and `/app/(auth)/login` pages
- **Session Management**: Creates sessions used throughout the application
- **Token Storage**: Tokens used for API authentication and session refresh

## Related Documentation

- [Auth Components](../../../../components/auth/README.md) - Login form implementation
- [Auth Library](../../../../lib/README.md) - Session and authentication utilities
- [Register API Route](../register/README.md) - User registration endpoint
- [Logout API Route](../logout/README.md) - Session termination endpoint
- [API Examples](../../../../../docs/API_EXAMPLES.md) - API usage patterns
- [Technical Architecture](../../../../../docs/TECHNICAL_ARCHITECTURE.md) - Authentication system design
