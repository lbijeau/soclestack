# API Examples

Practical examples for interacting with SocleStack APIs. All examples use `http://localhost:3000` as the base URL.

## Table of Contents

- [Authentication](#authentication)
  - [Register](#register)
  - [Login](#login)
  - [Login with 2FA](#login-with-2fa)
  - [Token Refresh](#token-refresh)
  - [Logout](#logout)
  - [Email Verification](#email-verification)
- [User Management](#user-management)
  - [Get Current Profile](#get-current-profile)
  - [Update Profile](#update-profile)
  - [Change Password](#change-password)
- [API Keys](#api-keys)
  - [Create API Key](#create-api-key)
  - [List API Keys](#list-api-keys)
  - [Use API Key for Authentication](#use-api-key-for-authentication)
- [Organizations](#organizations)
  - [Create Organization](#create-organization)
  - [Invite Member](#invite-member)
  - [List Members](#list-members)
- [Error Handling](#error-handling)
- [TypeScript Types](#typescript-types)

---

## Authentication

### Register

Create a new user account. Users must either create an organization or join via invite.

**cURL:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "username": "newuser",
    "firstName": "New",
    "lastName": "User",
    "organizationName": "My Company"
  }'
```

**JavaScript (fetch):**
```javascript
const response = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'newuser@example.com',
    password: 'SecurePassword123!',
    username: 'newuser',
    firstName: 'New',
    lastName: 'User',
    organizationName: 'My Company', // Creates new org, OR use inviteToken to join existing
  }),
});

const data = await response.json();
```

**Success Response (201):**
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "id": "user_abc123",
    "email": "newuser@example.com",
    "username": "newuser",
    "firstName": "New",
    "lastName": "User",
    "role": "USER",
    "emailVerified": false,
    "organization": {
      "id": "org_xyz789",
      "name": "My Company",
      "slug": "my-company",
      "role": "OWNER"
    }
  }
}
```

**Note:** New users receive a verification email. Use either `organizationName` (to create a new org) or `inviteToken` (to join existing org via invite).

### Login

Standard login with email and password.

**cURL:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "YourPassword123!",
    "rememberMe": false
  }'
```

**JavaScript (fetch):**
```javascript
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'YourPassword123!',
    rememberMe: false,
  }),
});

const data = await response.json();
// Store tokens for subsequent requests
const { accessToken, refreshToken } = data.tokens;
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "emailVerified": true
  },
  "tokens": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

### Login with 2FA

When 2FA is enabled, login returns a pending token instead of full authentication.

**Step 1: Initial Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "YourPassword123!"
  }'
```

**2FA Required Response:**
```json
{
  "requiresTwoFactor": true,
  "pendingToken": "eyJhbG..."
}
```

**Step 2: Validate 2FA Code**
```bash
curl -X POST http://localhost:3000/api/auth/2fa/validate \
  -H "Content-Type: application/json" \
  -d '{
    "pendingToken": "eyJhbG...",
    "code": "123456"
  }'
```

**JavaScript (complete flow):**
```javascript
async function loginWith2FA(email, password, getCodeFromUser) {
  // Step 1: Initial login
  const loginResponse = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginData = await loginResponse.json();

  // Check if 2FA is required
  if (loginData.requiresTwoFactor) {
    const code = await getCodeFromUser(); // Prompt user for TOTP code

    // Step 2: Validate 2FA
    const validateResponse = await fetch('/api/auth/2fa/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pendingToken: loginData.pendingToken,
        code,
      }),
    });

    return validateResponse.json();
  }

  return loginData;
}
```

### Token Refresh

Refresh an expired access token using the refresh token.

**cURL:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbG..."
  }'
```

**JavaScript:**
```javascript
async function refreshTokens(refreshToken) {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    // Refresh token expired - user must log in again
    throw new Error('Session expired');
  }

  const data = await response.json();
  return data.tokens;
}
```

**Success Response:**
```json
{
  "tokens": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

### Logout

End the current session.

**cURL:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**JavaScript:**
```javascript
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

// Clear stored tokens
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
```

### Email Verification

After registration, users receive an email with a verification token.

**Verify Email (from email link):**
```bash
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "verification_token_from_email"
  }'
```

**Success Response:**
```json
{
  "message": "Email verified successfully. You can now log in."
}
```

**Resend Verification Email (authenticated):**
```bash
curl -X POST http://localhost:3000/api/auth/resend-verification \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**JavaScript:**
```javascript
// Resend verification email for current user
const response = await fetch('/api/auth/resend-verification', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const data = await response.json();
// { message: "Verification email sent successfully" }
```

**Note:** Resending is rate-limited to 3 attempts per hour.

---

## User Management

### Get Current Profile

Retrieve the authenticated user's profile.

**cURL:**
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**JavaScript:**
```javascript
const response = await fetch('/api/auth/me', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const { user } = await response.json();
```

### Update Profile

Update profile information (name, email, username).

**cURL:**
```bash
curl -X PATCH http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "username": "janedoe"
  }'
```

**JavaScript:**
```javascript
const response = await fetch('/api/users/profile', {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    firstName: 'Jane',
    lastName: 'Doe',
    username: 'janedoe',
  }),
});

const { user, message } = await response.json();
```

**Note:** Changing email triggers re-verification. The user will receive a verification email at the new address.

### Change Password

Change the current user's password.

**cURL:**
```bash
curl -X PATCH http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123!",
    "newPassword": "NewSecurePassword456!"
  }'
```

**JavaScript:**
```javascript
const response = await fetch('/api/users/profile', {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    currentPassword: 'OldPassword123!',
    newPassword: 'NewSecurePassword456!',
  }),
});

if (response.ok) {
  // Password changed - other sessions are terminated
  console.log('Password changed successfully');
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot reuse last 3 passwords

---

## API Keys

API keys provide programmatic access without session cookies.

### Create API Key

**cURL:**
```bash
curl -X POST http://localhost:3000/api/keys \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "permission": "READ_ONLY",
    "expiresAt": "2027-12-31T23:59:59Z"
  }'
```

**JavaScript:**
```javascript
const response = await fetch('/api/keys', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'CI/CD Pipeline',
    permission: 'READ_ONLY', // or 'READ_WRITE'
    expiresAt: '2025-12-31T23:59:59Z', // optional
  }),
});

const data = await response.json();
// IMPORTANT: The full key is only shown once!
console.log('Save this key securely:', data.key);
```

**Success Response:**
```json
{
  "key": "ssk_x7Kp2mNqR9vBc4wL8yF6hJ3sD5tG0aE1",
  "id": "key_123",
  "name": "CI/CD Pipeline",
  "keyPrefix": "ssk_x7Kp",
  "permission": "READ_ONLY",
  "expiresAt": "2027-12-31T23:59:59.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "count": 1,
  "limit": 10
}
```

### List API Keys

**cURL:**
```bash
curl http://localhost:3000/api/keys \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**
```json
{
  "keys": [
    {
      "id": "key_123",
      "name": "CI/CD Pipeline",
      "keyPrefix": "ssk_x7Kp",
      "permission": "READ_ONLY",
      "expiresAt": "2027-12-31T23:59:59.000Z",
      "lastUsedAt": "2024-01-15T14:22:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1,
  "limit": 10
}
```

### Use API Key for Authentication

Use API keys in place of session tokens for programmatic access.

**cURL:**
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer ssk_x7Kp2mNqR9vBc4wL8yF6hJ3sD5tG0aE1"
```

**JavaScript:**
```javascript
const API_KEY = process.env.SOCLESTACK_API_KEY;

const response = await fetch('http://localhost:3000/api/auth/me', {
  headers: {
    Authorization: `Bearer ${API_KEY}`,
  },
});
```

**Permission Levels:**
- `READ_ONLY`: Only GET, HEAD, OPTIONS requests allowed
- `READ_WRITE`: All HTTP methods allowed

---

## Organizations

### Create Organization

Create a new organization (for users without one).

**cURL:**
```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation"
  }'
```

**JavaScript:**
```javascript
const response = await fetch('/api/organizations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Acme Corporation',
  }),
});

const { organization } = await response.json();
// organization.role will be 'OWNER'
```

**Success Response (201):**
```json
{
  "organization": {
    "id": "org_abc123",
    "name": "Acme Corporation",
    "slug": "acme-corporation",
    "role": "OWNER"
  }
}
```

### Invite Member

Invite a new member to the organization (requires ADMIN or OWNER role).

**cURL:**
```bash
curl -X POST http://localhost:3000/api/organizations/current/invites \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newmember@example.com",
    "role": "MEMBER"
  }'
```

**JavaScript:**
```javascript
const response = await fetch('/api/organizations/current/invites', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'newmember@example.com',
    role: 'MEMBER', // MEMBER, ADMIN (cannot invite OWNER)
  }),
});

const { invite } = await response.json();
```

**Success Response (201):**
```json
{
  "invite": {
    "id": "inv_xyz789",
    "email": "newmember@example.com",
    "role": "MEMBER",
    "expiresAt": "2024-01-22T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### List Members

Get all members of the current organization.

**cURL:**
```bash
curl http://localhost:3000/api/organizations/current/members \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**JavaScript:**
```javascript
const response = await fetch('/api/organizations/current/members', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const { members } = await response.json();
```

**Response:**
```json
{
  "members": [
    {
      "id": "user_123",
      "email": "owner@example.com",
      "username": "johndoe",
      "firstName": "John",
      "lastName": "Doe",
      "organizationRole": "OWNER",
      "isActive": true,
      "lastLoginAt": "2024-01-15T10:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "user_456",
      "email": "member@example.com",
      "username": "janesmith",
      "firstName": "Jane",
      "lastName": "Smith",
      "organizationRole": "MEMBER",
      "isActive": true,
      "lastLoginAt": "2024-01-15T14:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": {
      "email": ["Please enter a valid email address"]
    }
  }
}
```

**Error Types:**
| Type | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `AUTHENTICATION_ERROR` | 401 | Not authenticated or invalid credentials |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `SERVER_ERROR` | 500 | Internal server error |

**JavaScript Error Handling:**
```javascript
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Request failed');
    error.type = data.error?.type;
    error.details = data.error?.details;
    error.status = response.status;
    throw error;
  }

  return data;
}

// Usage
try {
  const user = await apiRequest('/api/auth/me');
} catch (error) {
  if (error.status === 401) {
    // Token expired - try refresh or redirect to login
  } else if (error.type === 'VALIDATION_ERROR') {
    // Show field-specific errors
    console.log(error.details);
  }
}
```

---

## TypeScript Types

Type definitions for API responses.

```typescript
// User
interface User {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Auth tokens
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Login response
interface LoginResponse {
  message: string;
  user: User;
  tokens: AuthTokens;
}

// 2FA required response
interface TwoFactorRequiredResponse {
  requiresTwoFactor: true;
  pendingToken: string;
}

// API Key
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permission: 'READ_ONLY' | 'READ_WRITE';
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

// API Key creation response (includes full key)
interface ApiKeyCreatedResponse extends ApiKey {
  key: string; // Only returned on creation!
  count: number;
  limit: number;
}

// Organization
interface Organization {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

// Organization member
interface OrganizationMember {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  organizationRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// API Error
interface ApiError {
  error: {
    type: 'VALIDATION_ERROR' | 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NOT_FOUND' | 'SERVER_ERROR';
    message: string;
    details?: Record<string, string[]>;
  };
}
```

---

## Rate Limits

Authentication endpoints are rate-limited to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth/login` | 10 attempts | 15 minutes |
| `POST /api/auth/register` | 3 attempts | 1 hour |
| `PATCH /api/users/profile` (password) | 5 attempts | 15 minutes |
| `POST /api/keys` | 10 attempts | 1 hour |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1705312800
```

When rate limited (HTTP 429):
```
Retry-After: 300
```
