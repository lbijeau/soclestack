# API Keys Routes

> Programmatic access management through API key creation, listing, and revocation.

## Purpose

These routes enable users to create and manage API keys for programmatic access to the application. API keys provide an alternative to session-based authentication for automated workflows and integrations.

## Contents

| File            | Description                           |
| --------------- | ------------------------------------- |
| `route.ts`      | List keys (GET), Create key (POST)    |
| `[id]/route.ts` | Get (GET), Update (PATCH), Revoke (DELETE) single key |

## Endpoints

### List API Keys

```
GET /api/keys
```

Returns all active (non-revoked) API keys for the authenticated user.

**Authentication:** Session required

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

**cURL Example:**

```bash
curl -X GET http://localhost:3000/api/keys \
  -H "Cookie: session=<session_cookie>"
```

---

### Create API Key

```
POST /api/keys
```

Creates a new API key. The full key is only returned once on creation.

**Authentication:** Session required

**Rate Limit:** 10 requests per hour

**Request Body:**

```json
{
  "name": "Production Server",
  "permission": "READ_WRITE",
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

| Field        | Type     | Required | Description                            |
| ------------ | -------- | -------- | -------------------------------------- |
| `name`       | string   | Yes      | Key name (1-50 characters)             |
| `permission` | string   | No       | `READ_ONLY` (default) or `READ_WRITE`  |
| `expiresAt`  | datetime | No       | ISO 8601 expiry date (null = no expiry)|

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

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_cookie>" \
  -d '{
    "name": "CI/CD Pipeline",
    "permission": "READ_ONLY",
    "expiresAt": "2025-06-01T00:00:00.000Z"
  }'
```

**Error Responses:**

| Status | Type              | Message                                      |
| ------ | ----------------- | -------------------------------------------- |
| 400    | VALIDATION_ERROR  | You have reached the maximum of 10 API keys  |
| 400    | VALIDATION_ERROR  | Invalid input data                           |
| 401    | AUTHENTICATION_ERROR | Not authenticated                         |
| 429    | AUTHORIZATION_ERROR  | Too many requests. Please try again later. |

---

### Get Single API Key

```
GET /api/keys/:id
```

Retrieves details for a specific API key.

**Authentication:** Session required

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

**cURL Example:**

```bash
curl -X GET http://localhost:3000/api/keys/clx1234567890 \
  -H "Cookie: session=<session_cookie>"
```

**Error Responses:**

| Status | Type              | Message              |
| ------ | ----------------- | -------------------- |
| 401    | AUTHENTICATION_ERROR | Not authenticated |
| 404    | NOT_FOUND         | API key not found    |

---

### Update API Key

```
PATCH /api/keys/:id
```

Updates an existing API key's name, permission, or expiry.

**Authentication:** Session required

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

**cURL Example:**

```bash
curl -X PATCH http://localhost:3000/api/keys/clx1234567890 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_cookie>" \
  -d '{"name": "Renamed Key", "permission": "READ_ONLY"}'
```

**Error Responses:**

| Status | Type              | Message              |
| ------ | ----------------- | -------------------- |
| 400    | VALIDATION_ERROR  | Invalid input data   |
| 401    | AUTHENTICATION_ERROR | Not authenticated |
| 404    | NOT_FOUND         | API key not found    |

---

### Revoke API Key

```
DELETE /api/keys/:id
```

Revokes (soft deletes) an API key. The key immediately becomes invalid.

**Authentication:** Session required

**Rate Limit:** 10 requests per hour

**Response (200):**

```json
{
  "message": "API key revoked successfully"
}
```

**cURL Example:**

```bash
curl -X DELETE http://localhost:3000/api/keys/clx1234567890 \
  -H "Cookie: session=<session_cookie>"
```

**Error Responses:**

| Status | Type              | Message                                    |
| ------ | ----------------- | ------------------------------------------ |
| 401    | AUTHENTICATION_ERROR | Not authenticated                       |
| 404    | NOT_FOUND         | API key not found                          |
| 429    | AUTHORIZATION_ERROR  | Too many requests. Please try again later. |

## Permission Levels

API keys support two permission levels:

| Permission   | Allowed Methods           | Use Case                    |
| ------------ | ------------------------- | --------------------------- |
| `READ_ONLY`  | GET, HEAD, OPTIONS        | Monitoring, data export     |
| `READ_WRITE` | All HTTP methods          | Full API access, automation |

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

| Setting             | Value | Description                    |
| ------------------- | ----- | ------------------------------ |
| `MAX_KEYS_PER_USER` | 10    | Maximum active keys per user   |
| `API_KEY_BYTES`     | 32    | Random bytes in key generation |
| `API_KEY_PREFIX`    | `lsk_`| Key prefix for identification  |

## Rate Limiting

| Operation   | Limit          | Window  |
| ----------- | -------------- | ------- |
| Create key  | 10 requests    | 1 hour  |
| Revoke key  | 10 requests    | 1 hour  |

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

| Action            | Logged Data                          |
| ----------------- | ------------------------------------ |
| `API_KEY_CREATED` | keyId, keyName, keyPrefix, permission|
| `API_KEY_UPDATED` | keyId, keyPrefix, changed fields     |
| `API_KEY_REVOKED` | keyId, keyName, keyPrefix            |

## Using API Keys

> **Implementation Status:** API key management (create, list, update, revoke) is fully implemented. However, using API keys for route authentication is planned but not yet active. Routes currently require session-based authentication. The infrastructure for API key authentication exists in `getAuthContext()` but is not yet integrated into route handlers.

### Planned Usage (Not Yet Implemented)

When API key authentication is fully integrated, you will authenticate with the `Authorization` header:

```bash
# Planned - not yet functional
curl -X GET http://localhost:3000/api/some-endpoint \
  -H "Authorization: Bearer lsk_abc123def456..."
```

The validation infrastructure exists and will check:
1. Valid format (`lsk_` prefix, minimum length)
2. Key exists and is not revoked
3. Key is not expired
4. User account is active
5. Permission level allows the HTTP method

### Current Workaround

Until API key authentication is integrated, use session-based authentication for all API calls:

```bash
curl -X GET http://localhost:3000/api/some-endpoint \
  -H "Cookie: soclestack-session=<session_cookie>"
```

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
