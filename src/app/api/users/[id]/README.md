# User Management API Route (Individual User)

## Purpose
Handles individual user operations including viewing user details, updating user roles, and managing user status. Supports both self-service operations and administrative management.

## Contents

### `route.ts`
**HTTP Methods**: GET, PATCH
**Purpose**: Individual user management and profile viewing

## API Specification

### Get User Details
```typescript
GET /api/users/[id]
```

#### Response (Success - 200)
```typescript
{
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
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z",
    "sessions": [
      {
        "id": "session-id",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2024-01-01T12:00:00Z",
        "expiresAt": "2024-01-08T12:00:00Z"
      }
    ]
  }
}
```

### Update User Role (Admin Only)
```typescript
PATCH /api/users/[id]
Content-Type: application/json

{
  "role": "MODERATOR"
}
```

### Update User Status (Admin Only)
```typescript
PATCH /api/users/[id]
Content-Type: application/json

{
  "isActive": false
}
```

#### Update Response (Success - 200)
```typescript
{
  "message": "User updated successfully",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "username",
    "firstName": "John",
    "lastName": "Doe",
    "role": "MODERATOR",
    "isActive": true,
    "emailVerified": true,
    "lastLoginAt": "2024-01-01T12:00:00Z",
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T13:00:00Z"
  }
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

#### Insufficient Permissions (403)
```typescript
{
  "error": {
    "type": "AUTHORIZATION_ERROR",
    "message": "Insufficient permissions"
  }
}
```

#### User Not Found (404)
```typescript
{
  "error": {
    "type": "NOT_FOUND",
    "message": "User not found"
  }
}
```

#### Invalid Self-Operation (400)
```typescript
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Cannot modify your own role/status"
  }
}
```

## Security & Authorization

### Access Control for GET
- **Self-Access**: Users can view their own profile and sessions
- **Admin/Moderator Access**: Can view any user's profile
- **Data Scope**: Session data only shown to user themselves or admins

### Access Control for PATCH
- **Admin Only**: Only administrators can modify user roles and status
- **Self-Protection**: Users cannot modify their own role or status
- **Role Hierarchy**: Maintains role hierarchy and prevents privilege escalation

## Features

### User Profile Viewing
- **Complete Profile**: Shows all user profile information
- **Session Management**: Displays active sessions for security monitoring
- **Access Control**: Respects privacy and authorization rules

### Administrative Operations
- **Role Management**: Update user roles (USER, MODERATOR, ADMIN)
- **Status Management**: Activate/deactivate user accounts
- **Audit Trail**: Updates include timestamp tracking

### Session Information
- **Active Sessions**: Shows all active user sessions
- **Security Details**: IP address and user agent for each session
- **Expiration Tracking**: Session expiration times for management

## Business Logic

### GET Request Flow
1. **Authentication Check**: Verify user is logged in
2. **Authorization Check**: Verify access permissions (self or admin/moderator)
3. **User Lookup**: Fetch user from database with session data
4. **Data Filtering**: Show sessions only to user themselves or admins
5. **Response**: Return user profile and session information

### PATCH Request Flow
1. **Authentication Check**: Verify user is logged in
2. **Authorization Check**: Verify admin permissions
3. **Input Validation**: Validate role or status update data
4. **Self-Modification Check**: Prevent users from modifying themselves
5. **Database Update**: Update user in database
6. **Response**: Return updated user information

### Security Safeguards
- **Self-Protection**: Prevents administrators from accidentally modifying their own accounts
- **Role Validation**: Ensures only valid roles can be assigned
- **Status Validation**: Proper boolean validation for status updates

## Dependencies
- **@/lib/auth**: `getCurrentUser`, `hasRequiredRole` for authentication
- **@/lib/validations**: `updateUserRoleSchema`, `updateUserStatusSchema` for validation
- **@/lib/db**: Prisma client for database operations
- **@/types/auth**: `AuthError` type definition

## Usage Examples

### Get User Profile
```typescript
async function getUserProfile(userId: string) {
  const response = await fetch(`/api/users/${userId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch user profile')
  }
  return response.json()
}
```

### Update User Role (Admin)
```typescript
async function updateUserRole(userId: string, newRole: string) {
  const response = await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: newRole }),
  })

  if (!response.ok) {
    throw new Error('Failed to update user role')
  }

  return response.json()
}
```

### Deactivate User Account (Admin)
```typescript
async function deactivateUser(userId: string) {
  const response = await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isActive: false }),
  })

  return response.ok
}
```

### Admin User Management
```typescript
function UserManagement({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)

  const handleRoleChange = async (newRole: string) => {
    try {
      const result = await updateUserRole(userId, newRole)
      setUser(result.user)
      toast.success('User role updated successfully')
    } catch (error) {
      toast.error('Failed to update user role')
    }
  }

  const handleStatusToggle = async () => {
    try {
      const result = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })

      if (result.ok) {
        const data = await result.json()
        setUser(data.user)
      }
    } catch (error) {
      toast.error('Failed to update user status')
    }
  }

  return (
    <div>
      {/* User management UI */}
    </div>
  )
}
```

## Integration Points
- **User Profile Pages**: Display individual user profiles
- **Admin Dashboard**: User management and administration
- **User Settings**: Self-service profile viewing
- **Session Management**: Security monitoring and session oversight
- **Audit Logs**: User modification tracking

## Validation Rules
- **Role Updates**: Only valid roles (USER, MODERATOR, ADMIN) allowed
- **Status Updates**: Boolean validation for isActive field
- **Self-Modification**: Users cannot modify their own role or status
- **Admin Requirements**: Role and status changes require admin permissions