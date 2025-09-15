# Current User API Route

## Purpose
Retrieves the current authenticated user's information from their session. Used for verifying authentication status and fetching user profile data.

## Contents

### `route.ts`
**HTTP Method**: GET
**Purpose**: Get current user information from session

## API Specification

### Request
```typescript
GET /api/auth/me
```

### Response (Success - 200)
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
    "createdAt": "2024-01-01T12:00:00Z"
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

#### Server Error (500)
```typescript
{
  "error": {
    "type": "SERVER_ERROR",
    "message": "An internal server error occurred"
  }
}
```

## Features

### Session-Based Authentication
- **Iron Session**: Reads user ID from encrypted session cookie
- **Database Lookup**: Fetches fresh user data from database
- **Active User Check**: Only returns data for active users

### User Data
- **Complete Profile**: Returns all safe user fields
- **Excludes Sensitive Data**: Password and internal tokens not included
- **Fresh Data**: Always fetched from database, not cached

## Business Logic

### Authentication Flow
1. **Session Check**: Verify user has valid session
2. **User Lookup**: Fetch user from database by session user ID
3. **Status Validation**: Ensure user is active
4. **Data Return**: Return user profile information

### Security Considerations
- **Session Required**: Must have valid iron-session cookie
- **Active Users Only**: Inactive users cannot access their data
- **No Sensitive Data**: Passwords and tokens are never returned

## Use Cases

### Authentication Check
```typescript
// Check if user is logged in
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me')
    if (response.ok) {
      const { user } = await response.json()
      return user
    }
    return null
  } catch (error) {
    return null
  }
}
```

### User Profile Display
```typescript
// Get user for profile display
async function getUserProfile() {
  const response = await fetch('/api/auth/me')
  if (!response.ok) {
    throw new Error('Not authenticated')
  }
  const { user } = await response.json()
  return user
}
```

### Permission Checking
```typescript
// Check user role for admin features
async function checkAdminAccess() {
  const user = await checkAuth()
  return user?.role === 'ADMIN'
}
```

## Dependencies
- **@/lib/auth**: `getCurrentUser` function for session and user lookup
- **@/types/auth**: `AuthError` type definition
- **Next.js**: Server-side API route handling

## Integration Points
- **Protected Pages**: Used by pages to verify authentication
- **Navigation Components**: Used to show/hide user-specific UI elements
- **Profile Components**: Used to populate user profile forms
- **Admin Pages**: Used to verify admin permissions
- **Middleware**: Could be called by authentication middleware

## Client-Side Usage Patterns

### React Hook Example
```typescript
function useCurrentUser() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data?.user || null))
      .finally(() => setLoading(false))
  }, [])

  return { user, loading }
}
```

### Route Protection
```typescript
// Protect pages that require authentication
export async function getServerSideProps(context) {
  const user = await getCurrentUser() // Server-side

  if (!user) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    }
  }

  return { props: { user } }
}
```

## Response Data Fields
- **id**: Unique user identifier
- **email**: User's email address
- **username**: Optional username
- **firstName/lastName**: Optional profile fields
- **role**: User's permission level (USER, MODERATOR, ADMIN)
- **isActive**: Account status
- **emailVerified**: Email verification status
- **lastLoginAt**: Last login timestamp
- **createdAt**: Account creation timestamp