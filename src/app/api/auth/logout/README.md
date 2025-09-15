# Logout API Route

## Purpose
Handles user logout by clearing session data and optionally removing specific session tokens from the database. Supports both current session logout and token-based logout.

## Contents

### `route.ts`
**HTTP Method**: POST
**Purpose**: Terminate user session and clear authentication state

## API Specification

### Request
```typescript
POST /api/auth/logout
Authorization: Bearer <session-token> (optional)
Content-Type: application/json
```

### Response (Success - 200)
```typescript
{
  "message": "Logout successful"
}
```

### Error Response (500)
```typescript
{
  "error": {
    "type": "SERVER_ERROR",
    "message": "An internal server error occurred"
  }
}
```

## Features

### Session Termination
- **Iron Session**: Destroys current browser session
- **Database Cleanup**: Removes session token from database (if provided)
- **Token Handling**: Accepts optional Bearer token for targeted logout

### Token-Based Logout
- **Authorization Header**: Reads `Authorization: Bearer <token>` header
- **Targeted Cleanup**: Removes specific session from database
- **Multi-Device Support**: Allows logout from specific devices

## Business Logic

### Logout Flow
1. **Token Extraction**: Parse Authorization header for session token
2. **Database Cleanup**: Remove session token from database (if provided)
3. **Session Destruction**: Clear iron-session data
4. **Response**: Return success confirmation

### Session Management
- **Current Session**: Always destroys the current iron-session
- **Database Session**: Only removes database session if token provided
- **Graceful Handling**: Works even if no token is provided

## Security Considerations

### Token Validation
- **Optional Token**: Logout works without providing a token
- **Hash Comparison**: Session tokens are hashed before database lookup
- **Error Handling**: Graceful failure if token cleanup fails

### Session Cleanup
- **Immediate Effect**: Session cleared immediately
- **Database Consistency**: Removes corresponding database records
- **Multi-Device**: Doesn't affect other active sessions unless token specified

## Dependencies
- **@/lib/auth**: `logoutUser` function for session management
- **Next.js**: Server-side API route handling

## Usage Examples

### Basic Logout (Current Session)
```typescript
async function logout() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
  })

  if (response.ok) {
    // Redirect to login page
    window.location.href = '/login'
  }
}
```

### Token-Based Logout (Specific Session)
```typescript
async function logoutFromDevice(sessionToken: string) {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
    },
  })

  return response.ok
}
```

### Client-Side Integration
```typescript
// Logout with cleanup
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })

    // Clear client-side storage
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')

    // Redirect to login
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
```

## Integration Points
- **Navigation Components**: Called from logout buttons in headers/menus
- **Session Management**: Used by session timeout handlers
- **Device Management**: Used in user profile for managing active sessions
- **Security**: Called when suspicious activity is detected

## Related Endpoints
- **POST /api/auth/login**: Creates sessions that this endpoint terminates
- **GET /api/auth/me**: May return 401 after logout
- **POST /api/auth/refresh**: Won't work with cleared sessions