# API Keys Routes

> Programmatic access management through API key creation, listing, and revocation.

## Purpose

These routes enable users to create and manage API keys for programmatic access to the application. API keys provide an alternative to session-based authentication for automated workflows and integrations.

## Contents

| File            | Description                                           |
| --------------- | ----------------------------------------------------- |
| `route.ts`      | List keys (GET), Create key (POST)                    |
| `[id]/route.ts` | Get (GET), Update (PATCH), Revoke (DELETE) single key |

## Endpoints

### List API Keys

```
GET /api/keys
```

Returns all active (non-revoked) API keys for the authenticated user.

**Authentication:** Session or API key (Bearer token)

**Response (200):**

```json
{
  "keys": [
    {
      "id": "clx1234567890",
      "name": "Production Server",
      "keyPrefix": "lsk_abc1",
      "permission": "READ_WRITE",
      "expiresAt": "2025-01-01T00:00:00.000Z",
      "lastUsedAt": "2024-12-15T10:30:00.000Z",
      "createdAt": "2024-06-01T00:00:00.000Z"
    }
  ],
  "count": 1,
  "limit": 10
}
```

**cURL Examples:**

```bash
# With session cookie
curl -X GET http://localhost:3000/api/keys \
  -H "Cookie: soclestack-session=<session_cookie>"

# With API key
curl -X GET http://localhost:3000/api/keys \
  -H "Authorization: Bearer lsk_your_api_key_here"
```

---

### Create API Key

```
POST /api/keys
```

Creates a new API key. The full key is only returned once on creation.

**Authentication:** Session or API key (Bearer token)

**Rate Limit:** 10 requests per hour

**Request Body:**

```json
{
  "name": "Production Server",
  "permission": "READ_WRITE",
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

| Field        | Type     | Required | Description                             |
| ------------ | -------- | -------- | --------------------------------------- |
| `name`       | string   | Yes      | Key name (1-50 characters)              |
| `permission` | string   | No       | `READ_ONLY` (default) or `READ_WRITE`   |
| `expiresAt`  | datetime | No       | ISO 8601 expiry date (null = no expiry) |

**Response (200):**

```json
{
  "key": "lsk_abc123def456...",
  "id": "clx1234567890",
  "name": "Production Server",
  "keyPrefix": "lsk_abc1",
  "permission": "READ_WRITE",
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "createdAt": "2024-12-15T10:00:00.000Z",
  "count": 1,
  "limit": 10
}
```

> **Important:** The `key` field contains the full API key and is only returned on creation. Store it securely - it cannot be retrieved again.

**cURL Examples:**

```bash
# With session cookie
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -H "Cookie: soclestack-session=<session_cookie>" \
  -d '{
    "name": "CI/CD Pipeline",
    "permission": "READ_ONLY",
    "expiresAt": "2025-06-01T00:00:00.000Z"
  }'

# With API key (requires READ_WRITE permission)
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lsk_your_readwrite_key" \
  -d '{"name": "New Key", "permission": "READ_ONLY"}'
```

**Error Responses:**

| Status | Type                 | Message                                     |
| ------ | -------------------- | ------------------------------------------- |
| 400    | VALIDATION_ERROR     | You have reached the maximum of 10 API keys |
| 400    | VALIDATION_ERROR     | Invalid input data                          |
| 401    | AUTHENTICATION_ERROR | Not authenticated                           |
| 429    | AUTHORIZATION_ERROR  | Too many requests. Please try again later.  |

---

### Get Single API Key

```
GET /api/keys/:id
```

Retrieves details for a specific API key.

**Authentication:** Session or API key (Bearer token)

**Response (200):**

```json
{
  "id": "clx1234567890",
  "name": "Production Server",
  "keyPrefix": "lsk_abc1",
  "permission": "READ_WRITE",
  "expiresAt": "2025-01-01T00:00:00.000Z",
  "lastUsedAt": "2024-12-15T10:30:00.000Z",
  "createdAt": "2024-06-01T00:00:00.000Z"
}
```

**cURL Examples:**

```bash
# With session cookie
curl -X GET http://localhost:3000/api/keys/clx1234567890 \
  -H "Cookie: soclestack-session=<session_cookie>"

# With API key
curl -X GET http://localhost:3000/api/keys/clx1234567890 \
  -H "Authorization: Bearer lsk_your_api_key_here"
```

**Error Responses:**

| Status | Type                 | Message           |
| ------ | -------------------- | ----------------- |
| 401    | AUTHENTICATION_ERROR | Not authenticated |
| 404    | NOT_FOUND            | API key not found |

---

### Update API Key

```
PATCH /api/keys/:id
```

Updates an existing API key's name, permission, or expiry.

**Authentication:** Session or API key (Bearer token)

**Request Body:**

```json
{
  "name": "Updated Name",
  "permission": "READ_ONLY",
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

All fields are optional. Only provided fields are updated.

**Response (200):**

```json
{
  "id": "clx1234567890",
  "name": "Updated Name",
  "keyPrefix": "lsk_abc1",
  "permission": "READ_ONLY",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "lastUsedAt": "2024-12-15T10:30:00.000Z",
  "createdAt": "2024-06-01T00:00:00.000Z"
}
```

**cURL Examples:**

```bash
# With session cookie
curl -X PATCH http://localhost:3000/api/keys/clx1234567890 \
  -H "Content-Type: application/json" \
  -H "Cookie: soclestack-session=<session_cookie>" \
  -d '{"name": "Renamed Key", "permission": "READ_ONLY"}'

# With API key (requires READ_WRITE permission)
curl -X PATCH http://localhost:3000/api/keys/clx1234567890 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lsk_your_readwrite_key" \
  -d '{"name": "Renamed Key"}'
```

**Error Responses:**

| Status | Type                 | Message            |
| ------ | -------------------- | ------------------ |
| 400    | VALIDATION_ERROR     | Invalid input data |
| 401    | AUTHENTICATION_ERROR | Not authenticated  |
| 404    | NOT_FOUND            | API key not found  |

---

### Revoke API Key

```
DELETE /api/keys/:id
```

Revokes (soft deletes) an API key. The key immediately becomes invalid.

**Authentication:** Session or API key (Bearer token)

**Rate Limit:** 10 requests per hour

**Response (200):**

```json
{
  "message": "API key revoked successfully"
}
```

**cURL Examples:**

```bash
# With session cookie
curl -X DELETE http://localhost:3000/api/keys/clx1234567890 \
  -H "Cookie: soclestack-session=<session_cookie>"

# With API key (requires READ_WRITE permission)
curl -X DELETE http://localhost:3000/api/keys/clx1234567890 \
  -H "Authorization: Bearer lsk_your_readwrite_key"
```

**Error Responses:**

| Status | Type                 | Message                                    |
| ------ | -------------------- | ------------------------------------------ |
| 401    | AUTHENTICATION_ERROR | Not authenticated                          |
| 404    | NOT_FOUND            | API key not found                          |
| 429    | AUTHORIZATION_ERROR  | Too many requests. Please try again later. |

## Permission Levels

API keys support two permission levels:

| Permission   | Allowed Methods    | Use Case                    |
| ------------ | ------------------ | --------------------------- |
| `READ_ONLY`  | GET, HEAD, OPTIONS | Monitoring, data export     |
| `READ_WRITE` | All HTTP methods   | Full API access, automation |

## Key Format

API keys follow this format:

```
lsk_<base64url-encoded-random-bytes>
```

- **Prefix**: `lsk_` (4 characters)
- **Random Part**: 32 bytes encoded as base64url (~43 characters)
- **Total Length**: ~47 characters minimum

Only the first 8 characters (`keyPrefix`) are stored and shown for identification after creation.

## Configuration

| Setting             | Value  | Description                    |
| ------------------- | ------ | ------------------------------ |
| `MAX_KEYS_PER_USER` | 10     | Maximum active keys per user   |
| `API_KEY_BYTES`     | 32     | Random bytes in key generation |
| `API_KEY_PREFIX`    | `lsk_` | Key prefix for identification  |

## Rate Limiting

| Operation  | Limit       | Window |
| ---------- | ----------- | ------ |
| Create key | 10 requests | 1 hour |
| Revoke key | 10 requests | 1 hour |

List, get, and update operations are not rate limited beyond session requirements.

## Security Considerations

- **One-time display**: Full key is only shown on creation; store it securely
- **Hashed storage**: Keys are stored as SHA-256 hashes, not plaintext
- **Soft deletion**: Revoked keys are marked, not deleted, for audit purposes
- **User isolation**: Keys are scoped to the authenticated user only
- **Expiry support**: Optional expiry dates for time-limited access
- **Last used tracking**: `lastUsedAt` updates on each key usage

## Audit Events

All key operations are logged:

| Action            | Logged Data                           |
| ----------------- | ------------------------------------- |
| `API_KEY_CREATED` | keyId, keyName, keyPrefix, permission |
| `API_KEY_UPDATED` | keyId, keyPrefix, changed fields      |
| `API_KEY_REVOKED` | keyId, keyName, keyPrefix             |

## Using API Keys

API keys can be used for programmatic access to API endpoints. Authenticate using the `Authorization` header with a Bearer token:

```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer lsk_abc123def456..."
```

### Validation Process

When an API key is used, the system checks:

1. **Format validation**: Key starts with `lsk_` prefix and meets minimum length
2. **Existence check**: Key exists in database and is not revoked
3. **Expiry check**: Key has not expired (if expiry date was set)
4. **User status**: The key's owner account is active
5. **Permission check**: Key permission level allows the HTTP method being used

### Permission Enforcement

- **READ_ONLY** keys: Only allow `GET`, `HEAD`, and `OPTIONS` requests
- **READ_WRITE** keys: Allow all HTTP methods

If a READ_ONLY key attempts a `POST`, `PATCH`, `PUT`, or `DELETE` request, the response will be:

```json
{
  "error": {
    "type": "AUTHORIZATION_ERROR",
    "message": "This API key does not have permission for this operation"
  }
}
```

### Session vs API Key Authentication

Both authentication methods are supported on most endpoints:

| Method  | Header                           | Use Case                        |
| ------- | -------------------------------- | ------------------------------- |
| Session | `Cookie: soclestack-session=...` | Browser-based access, web UI    |
| API Key | `Authorization: Bearer lsk_...`  | Programmatic access, automation |

### Endpoints Supporting API Key Auth

The following routes support API key authentication:

- `GET /api/users` - List users (requires MODERATOR role)
- `GET/PATCH/DELETE /api/users/:id` - Manage specific user
- `PATCH /api/users/profile` - Update profile (password changes require session auth)
- `GET/POST /api/keys` - Manage API keys
- `GET/PATCH/DELETE /api/keys/:id` - Manage specific API key

### Restrictions

Some operations are restricted to session authentication only:

- **Password changes**: Require session auth (must verify current password)
- **2FA operations**: Require session auth for security
- **OAuth linking**: Require session auth

### Last Used Tracking

Each time an API key is used for authentication, its `lastUsedAt` timestamp is automatically updated. This helps identify unused keys for cleanup.

## TypeScript Types

```typescript
import { ApiKeyPermission } from '@prisma/client';

interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  permission: ApiKeyPermission; // 'READ_ONLY' | 'READ_WRITE'
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface CreateApiKeyRequest {
  name: string;
  permission?: ApiKeyPermission;
  expiresAt?: string | null;
}

interface UpdateApiKeyRequest {
  name?: string;
  permission?: ApiKeyPermission;
  expiresAt?: string | null;
}
```

## Related Documentation

- [Auth Library](../../../lib/README.md) - Authentication utilities
- [API Examples](../../../../docs/API_EXAMPLES.md) - General API patterns
- [Technical Architecture](../../../../docs/TECHNICAL_ARCHITECTURE.md) - System design
