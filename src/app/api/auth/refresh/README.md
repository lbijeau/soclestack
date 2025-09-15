# Token Refresh API Route

## Purpose
Refreshes expired access tokens using valid refresh tokens. Implements the refresh token flow for maintaining user sessions without requiring re-authentication.

## Contents

### `route.ts`
**HTTP Method**: POST
**Purpose**: Exchange refresh token for new access and refresh tokens

## API Specification

### Request
```typescript
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Response (Success - 200)
```typescript
{
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Error Responses

#### Missing Refresh Token (400)
```typescript
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Refresh token is required"
  }
}
```

#### Invalid/Expired Token (401)
```typescript
{
  "error": {
    "type": "AUTHENTICATION_ERROR",
    "message": "Invalid or expired refresh token"
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

## Token Management

### Access Tokens
- **Lifetime**: Short-lived (typically 15 minutes)
- **Purpose**: API authentication and authorization
- **Contains**: User ID, email, role, expiration
- **Security**: Should be stored securely and refreshed frequently

### Refresh Tokens
- **Lifetime**: Long-lived (typically 7 days)
- **Purpose**: Generate new access tokens
- **Contains**: User ID, token ID, expiration
- **Security**: More sensitive, should be stored very securely

## Security Features

### Token Validation
- **JWT Verification**: Validates refresh token signature and expiration
- **User Verification**: Ensures user still exists and is active
- **Token Rotation**: Generates new refresh token with each request

### Security Considerations
- **Automatic Rotation**: New refresh token issued with each refresh
- **User Status Check**: Validates user is still active before issuing tokens
- **Signature Verification**: Ensures token hasn't been tampered with

## Business Logic

### Refresh Flow
1. **Token Validation**: Verify refresh token format and presence
2. **JWT Verification**: Validate refresh token signature and expiration
3. **User Lookup**: Verify user exists and is active
4. **Token Generation**: Create new access and refresh tokens
5. **Response**: Return new token pair

### Error Handling
- **Invalid Token**: Returns 401 for expired or malformed tokens
- **User Inactive**: Returns 401 if user account is deactivated
- **Server Errors**: Returns 500 for unexpected failures

## Dependencies
- **@/lib/auth**: `refreshAccessToken` function for token management
- **@/types/auth**: `AuthError` type definition
- **Next.js**: Server-side API route handling

## Usage Examples

### Client-Side Implementation
```typescript
async function refreshTokens(refreshToken: string) {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    throw new Error('Token refresh failed')
  }

  const { tokens } = await response.json()
  return tokens
}
```

### Automatic Token Management
```typescript
class TokenManager {
  private accessToken: string
  private refreshToken: string

  async makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
    try {
      // Try request with current access token
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${this.accessToken}`,
        },
      })

      if (response.status === 401) {
        // Access token expired, refresh it
        const newTokens = await this.refreshTokens()
        this.accessToken = newTokens.accessToken
        this.refreshToken = newTokens.refreshToken

        // Retry original request
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${this.accessToken}`,
          },
        })
      }

      return response
    } catch (error) {
      // Refresh failed, redirect to login
      window.location.href = '/login'
      throw error
    }
  }

  private async refreshTokens() {
    return refreshTokens(this.refreshToken)
  }
}
```

### React Hook for Token Management
```typescript
function useTokenRefresh() {
  const refreshTokens = useCallback(async (refreshToken: string) => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        throw new Error('Refresh failed')
      }

      return await response.json()
    } catch (error) {
      // Clear tokens and redirect to login
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      router.push('/login')
      throw error
    }
  }, [])

  return { refreshTokens }
}
```

## Integration Points
- **API Clients**: Used by API client libraries for automatic token refresh
- **Axios Interceptors**: Can be integrated with HTTP interceptors
- **Authentication Guards**: Used by route guards to maintain sessions
- **Background Services**: Used by service workers for background token refresh

## Best Practices
- **Secure Storage**: Store refresh tokens securely (httpOnly cookies recommended)
- **Token Rotation**: Always use the new refresh token from the response
- **Error Handling**: Implement proper fallback to login on refresh failure
- **Background Refresh**: Refresh tokens before access token expires
- **Single Use**: Treat refresh tokens as single-use (new one issued each time)