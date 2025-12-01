# API Keys Design

## Overview

Enable users to create API keys for programmatic access to the system. Keys are user-scoped, support read-only or read-write permissions, and optionally expire.

## Data Model

```prisma
model ApiKey {
  id          String    @id @default(cuid())
  userId      String    @map("user_id")
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String                  // User-friendly label, e.g., "CI/CD Pipeline"
  keyHash     String    @map("key_hash")  // SHA-256 hash of the key
  keyPrefix   String    @map("key_prefix") // First 8 chars for identification, e.g., "lsk_a8f3"

  permission  ApiKeyPermission @default(READ_ONLY)
  expiresAt   DateTime? @map("expires_at") // Null = never expires
  lastUsedAt  DateTime? @map("last_used_at")

  createdAt   DateTime  @default(now()) @map("created_at")
  revokedAt   DateTime? @map("revoked_at") // Soft delete - null = active

  @@index([userId])
  @@index([keyHash])
  @@map("api_keys")
}

enum ApiKeyPermission {
  READ_ONLY   // GET requests only
  READ_WRITE  // All methods
}
```

Add relation to User model:
```prisma
model User {
  // ... existing fields
  apiKeys ApiKey[]
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/keys | Create new API key (returns full key once) |
| GET | /api/keys | List user's API keys (metadata only) |
| GET | /api/keys/[id] | Get single key details |
| PATCH | /api/keys/[id] | Update key (name, permission, expiration) |
| DELETE | /api/keys/[id] | Revoke key (soft delete) |

### Create Key

```typescript
// POST /api/keys
Request: {
  name: string,           // Required, 1-50 chars
  permission: 'READ_ONLY' | 'READ_WRITE',
  expiresAt?: string      // ISO date, optional
}

Response: {
  key: "lsk_x7Kp2mNqR9vBc4wL8yF6hJ3sD5tG0aE1",  // Only shown once
  id: "clx...",
  name: "CI/CD Pipeline",
  keyPrefix: "lsk_x7Kp",
  permission: "READ_WRITE",
  expiresAt: null,
  createdAt: "2025-11-30T..."
}
```

### List Keys

```typescript
// GET /api/keys
Response: {
  keys: [{
    id: "clx...",
    name: "CI/CD Pipeline",
    keyPrefix: "lsk_x7Kp",
    permission: "READ_WRITE",
    expiresAt: null,
    lastUsedAt: "2025-11-29T...",
    createdAt: "2025-11-30T...",
    revokedAt: null
  }],
  count: 3,
  limit: 10
}
```

## Key Format & Security

### Generation
- Format: `lsk_` prefix + 32 random bytes (base64url encoded)
- Total length: ~48 characters
- Example: `lsk_x7Kp2mNqR9vBc4wL8yF6hJ3sD5tG0aE1`

### Storage
- Store SHA-256 hash in `keyHash` column
- Store first 8 chars in `keyPrefix` for identification
- Never store or log the raw key

### Authentication
- Header: `Authorization: Bearer lsk_...`
- Middleware detects `lsk_` prefix, hashes key, looks up in DB
- Update `lastUsedAt` on successful auth

### Validation Rules
- Name: 1-50 characters, required
- Expiration: optional, must be in future if provided
- Max 10 keys per user

### Permission Enforcement
- `READ_ONLY`: Only GET and HEAD methods allowed (403 for others)
- `READ_WRITE`: All methods allowed
- Keys cannot exceed user's own permissions (enforced by user role checks)

### Automatic Invalidation
- User deactivated → keys stop working (check user.isActive)
- User deleted → keys cascade deleted
- Key revoked → check `revokedAt IS NULL`
- Key expired → check `expiresAt IS NULL OR expiresAt > NOW()`

## Audit Events

| Event | When |
|-------|------|
| API_KEY_CREATED | Key created |
| API_KEY_UPDATED | Key name/permission/expiry changed |
| API_KEY_REVOKED | Key deleted/revoked |
| API_KEY_USED | Key used for authentication (optional, may be noisy) |

## UI Components

### Location
New tab or section at `/profile/api-keys`

### Key List View
- Table columns: Name, Prefix, Permission, Expires, Last Used, Actions
- Visual indicators:
  - Red: expired
  - Yellow: expiring within 7 days
  - Gray: never used
- Actions: Edit, Revoke

### Create Key Modal
- Name input (required)
- Permission dropdown: Read-only / Read-write
- Expiration: Never / Custom date picker
- Counter: "3 of 10 keys used"
- Disabled if at limit

### Key Created Modal (One-time)
- Display full key with copy button
- Warning: "This key will only be shown once. Copy it now."
- Checkbox: "I have copied my key" (required to close)

### Revoke Confirmation
- Warning: "Are you sure? Any applications using this key will stop working immediately."
- Show key name and prefix for confirmation

## Implementation Order

1. Add Prisma model and run migration
2. Create API key utility functions (generate, hash, validate)
3. Implement API endpoints
4. Add middleware for API key authentication
5. Create UI components
6. Add audit logging
7. Update documentation
