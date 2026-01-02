# User Profile API Route

## Purpose

Handles user profile updates and password changes. Allows authenticated users to modify their own profile information and change their password with proper validation.

## Contents

### `route.ts`

**HTTP Method**: PATCH
**Purpose**: Update user profile information or change password

## API Specification

### Profile Update Request

```typescript
PATCH /api/users/profile
Content-Type: application/json

{
  "username": "newusername",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Password Change Request

```typescript
PATCH /api/users/profile
Content-Type: application/json

{
  "currentPassword": "oldPassword",
  "newPassword": "newSecurePassword"
}
```

### Response (Success - 200)

#### Profile Update Success

```typescript
{
  "message": "Profile updated successfully",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "newusername",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "isActive": true,
    "emailVerified": true,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T13:00:00Z"
  }
}
```

#### Password Change Success

```typescript
{
  "message": "Password changed successfully"
}
```

### Error Responses

#### Not Authenticated (401)

```typescript
{
  "error": {
    "type": "AUTHENTICATION_ERROR",
    "message": "Not authenticated"
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
      "username": ["Username must be at least 3 characters"],
      "newPassword": ["Password must be at least 8 characters"]
    }
  }
}
```

#### Wrong Current Password (400)

```typescript
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Current password is incorrect"
  }
}
```

#### Username Conflict (409)

```typescript
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Username is already taken",
    "details": {
      "username": ["This username is already in use"]
    }
  }
}
```

## Features

### Profile Updates

- **Editable Fields**: username, firstName, lastName
- **Validation**: Input validation for all fields
- **Uniqueness Check**: Ensures username uniqueness
- **Real-time Response**: Returns updated user data

### Password Changes

- **Current Password Verification**: Must provide correct current password
- **Password Hashing**: New passwords are securely hashed
- **Validation**: Password strength requirements enforced
- **Security**: No password returned in response

## Security Features

### Authentication Required

- **Session Check**: Must have valid session to access
- **User Verification**: Verifies user exists and is active
- **Self-Service Only**: Users can only update their own profile

### Password Security

- **Current Password Verification**: Prevents unauthorized password changes
- **Secure Hashing**: bcrypt with automatic salt generation
- **No Password Exposure**: Passwords never returned in responses
- **Validation**: Enforces password complexity requirements

### Data Validation

- **Input Sanitization**: All inputs validated and sanitized
- **Type Safety**: TypeScript ensures type correctness
- **Business Rules**: Enforces username uniqueness and format rules

## Business Logic

### Profile Update Flow

1. **Authentication Check**: Verify user is logged in
2. **Input Validation**: Validate profile fields using schema
3. **Uniqueness Check**: Verify username is available (if changed)
4. **Database Update**: Update user record in database
5. **Response**: Return updated user profile

### Password Change Flow

1. **Authentication Check**: Verify user is logged in
2. **Input Validation**: Validate password change request
3. **Current Password Verification**: Verify current password is correct
4. **Password Hashing**: Hash new password securely
5. **Database Update**: Store new password hash
6. **Response**: Confirm password change (no sensitive data)

### Conflict Resolution

- **Username Conflicts**: Check username availability before update
- **Error Handling**: Specific error messages for different validation failures
- **Atomic Updates**: Database updates are atomic to prevent inconsistencies

## Dependencies

- **@/lib/auth**: `getCurrentUser` for authentication
- **@/lib/validations**: `updateProfileSchema`, `changePasswordSchema` for validation
- **@/lib/security**: `hashPassword`, `verifyPassword` for password operations
- **@/lib/db**: Prisma client for database operations
- **@/types/auth**: `AuthError` type definition

## Usage Examples

### Update Profile Information

```typescript
async function updateProfile(profileData: {
  username?: string;
  firstName?: string;
  lastName?: string;
}) {
  const response = await fetch('/api/users/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return response.json();
}
```

### Change Password

```typescript
async function changePassword(currentPassword: string, newPassword: string) {
  const response = await fetch('/api/users/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword,
      newPassword,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return response.json();
}
```

### React Profile Form

```typescript
function ProfileForm() {
  const [profile, setProfile] = useState({
    username: '',
    firstName: '',
    lastName: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await updateProfile(profile)
      toast.success('Profile updated successfully')
      // Update local state with returned user data
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Profile form fields */}
    </form>
  )
}
```

### Password Change Form

```typescript
function PasswordChangeForm() {
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await changePassword(passwords.currentPassword, passwords.newPassword)
      toast.success('Password changed successfully')
      setPasswords({ currentPassword: '', newPassword: '' })
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Password form fields */}
    </form>
  )
}
```

## Integration Points

- **Profile Pages**: Used by user profile management pages
- **Settings Forms**: Integrated with user settings interfaces
- **Account Security**: Password change functionality for security settings
- **User Dashboard**: Profile editing within user dashboard

## Validation Rules

- **Username**: Minimum 3 characters, alphanumeric and underscores allowed
- **Names**: Optional fields, reasonable length limits
- **Password**: Minimum 8 characters, complexity requirements
- **Current Password**: Must match existing password hash
