# Register API Route

## Purpose

Handles user registration with email verification workflow. Creates new user accounts with secure password hashing and implements comprehensive validation and conflict checking.

## Contents

### `route.ts`

**HTTP Method**: POST
**Purpose**: Register new user accounts with email verification

## API Specification

### Request

```typescript
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword",
  "username": "optional-username",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Response (Success - 201)

```typescript
{
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "username",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "emailVerified": false,
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

### Error Responses

#### Rate Limited (429)

```typescript
{
  "error": {
    "type": "AUTHORIZATION_ERROR",
    "message": "Too many registration attempts. Please try again later."
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
      "password": ["Password must be at least 8 characters"]
    }
  }
}
```

#### User Already Exists (409)

```typescript
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "A user with this email already exists",
    "details": {
      "email": ["This email is already taken"]
    }
  }
}
```

## Security Features

### Rate Limiting

- **Limit**: 3 attempts per IP address
- **Window**: 1 hour
- **Key**: `register:{clientIP}`
- **Purpose**: Prevent spam registrations and abuse

### Password Security

- **Hashing**: bcrypt with automatic salt generation
- **Storage**: Only hashed passwords stored in database
- **Validation**: Password strength requirements enforced

### Email Verification

- **Token Generation**: Secure random token for email verification
- **Expiration**: 24-hour token lifetime
- **Process**: User must verify email before account activation

### Conflict Detection

- **Email Uniqueness**: Prevents duplicate email registrations
- **Username Uniqueness**: Prevents duplicate usernames (if provided)
- **Specific Errors**: Returns which field conflicts for better UX

## Business Logic

### Registration Flow

1. **Rate Limit Check**: Verify IP hasn't exceeded registration attempts
2. **Input Validation**: Validate all required and optional fields
3. **Duplicate Check**: Verify email and username are unique
4. **Password Hashing**: Secure password storage preparation
5. **Token Generation**: Create email verification token
6. **User Creation**: Store user in database with unverified status
7. **Email Notification**: Send verification email (TODO: implement)

### Data Handling

- **Required Fields**: Email and password
- **Optional Fields**: Username, firstName, lastName
- **Default Role**: All new users start with 'USER' role
- **Email Status**: Users start with `emailVerified: false`

## Field Validation

### Email

- Format validation (valid email syntax)
- Uniqueness check across all users
- Required field

### Password

- Minimum length requirements
- Complexity requirements (handled by validation schema)
- Secure hashing before storage

### Username

- Optional field
- Uniqueness check if provided
- Username format validation

### Profile Fields

- firstName: Optional string
- lastName: Optional string
- No special validation beyond basic string rules

## Dependencies

- **@/lib/validations**: `registerSchema` for input validation
- **@/lib/security**: `hashPassword`, `generateResetToken` for security operations
- **@/lib/db**: Prisma client for database operations
- **@/lib/auth**: Rate limiting and IP extraction utilities
- **@/types/auth**: Type definitions for requests and responses

## Implementation Notes

### Email Verification (TODO)

```typescript
// Current implementation logs token to console
console.log(`Email verification token for ${email}: ${emailVerificationToken}`);

// Production implementation should:
// 1. Send email with verification link
// 2. Include token in verification URL
// 3. Handle email delivery failures
```

### Token Usage

- **Storage**: `passwordResetToken` field (reused for email verification)
- **Expiration**: `passwordResetExpires` field (24 hours from creation)
- **Security**: Token should be used once and then invalidated

## Usage Example

### Client-side Implementation

```typescript
async function register(userData: RegisterData) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error.message);
  }

  return data;
}
```

### Integration Points

- **Registration Forms**: Used by `/app/register` and `/app/(auth)/register` pages
- **Email Verification**: Tokens used by `/api/auth/verify-email` endpoint
- **User Management**: Created users appear in admin user management interfaces
