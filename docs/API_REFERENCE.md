# API Reference

**Last Scanned**: 2026-01-02
**Base URL**: `/api`

This document provides a comprehensive reference for all SocleStack API endpoints, including authentication, user management, organizations, and security features.

---

## Authentication Endpoints

Endpoints related to user lifecycle, sessions, and multi-factor authentication.

### `POST /api/auth/login`
Authenticates a user and creates a new session.

- **Auth Required**: No
- **Rate Limit**: 10 attempts / 15 minutes
- **Body**:
  - `email` (string, required): User's email address.
  - `password` (string, required): User's password.
  - `rememberMe` (boolean, optional): If true, creates a long-lived session.
- **Success Response**:
  - `200 OK`: Returns user profile and JWT tokens.
  - `200 OK (2FA)`: Returns `requiresTwoFactor: true` and a `pendingToken`.
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials.
  - `423 Locked`: Account temporarily locked due to failed attempts.

### `POST /api/auth/register`
Creates a new user account.

- **Auth Required**: No
- **Rate Limit**: 3 attempts / hour
- **Body**:
  - `email`, `password`, `username`, `firstName`, `lastName`.
- **Success Response**: `201 Created`

### `POST /api/auth/logout`
Revokes the current session and clears cookies.

- **Auth Required**: Yes
- **Success Response**: `200 OK`

---

## User Management

### `GET /api/users`
Lists all users with pagination and filtering.

- **Auth Required**: Yes (MODERATOR+)
- **Query Parameters**:
  - `page`, `limit`: Pagination.
  - `search`: Filter by name/email/username.
  - `role`: Filter by role (USER, ADMIN, etc).
  - `isActive`: Filter by status.
- **Success Response**: `200 OK` with `users` array and `pagination` metadata.

### `GET /api/users/profile`
Gets the current authenticated user's profile.

- **Auth Required**: Yes
- **Success Response**: `200 OK`

---

## Organizations

### `GET /api/organizations`
Lists organizations the user belongs to.

- **Auth Required**: Yes
- **Success Response**: `200 OK`

### `POST /api/organizations`
Creates a new organization.

- **Auth Required**: Yes
- **Success Response**: `201 Created`

---

## API Keys

### `GET /api/keys`
Lists the user's active API keys.

- **Auth Required**: Yes
- **Success Response**: `200 OK`

### `POST /api/keys`
Generates a new API key.

- **Auth Required**: Yes
- **Body**:
  - `name`: Label for the key.
  - `permission`: `READ_ONLY` or `READ_WRITE`.
  - `expiresAt`: Optional expiration date.
- **Success Response**: `201 Created`. **Warning**: The raw key is only shown once in this response.

---

## Error Handling

All API errors follow a standardized format:

```json
{
  "error": {
    "type": "VALIDATION_ERROR | AUTHENTICATION_ERROR | AUTHORIZATION_ERROR | SERVER_ERROR",
    "message": "Human readable message",
    "details": {}
  }
}
```
