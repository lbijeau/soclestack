# Environment Variable Validation Design

**Date:** 2026-01-03
**Issue:** #24 - Add environment variable validation on startup
**Parent Epic:** #37 (Production Infrastructure)

## Overview

Replace the basic env var existence checks with Zod-based schema validation that provides type-safe access, value validation, and clear error messages at startup.

## Current State

- Basic validation in `src/lib/config/security.ts` checks 3 secrets exist
- Runs via `src/instrumentation.ts` at startup (production only)
- No type safety - uses `process.env.X!` pattern throughout
- No value validation (min lengths, formats)
- Runtime errors when optional vars are accessed incorrectly

## Design

### Schema Structure

Create `src/lib/env.ts` with Zod schema organized by category:

```typescript
import { z } from 'zod';

const serverEnvSchema = z.object({
  // === Required Security Secrets ===
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  // === Database ===
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // === Runtime ===
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // === Optional: Email ===
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // === Optional: OAuth ===
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
})
.refine(
  (data) => !(data.GOOGLE_CLIENT_ID && !data.GOOGLE_CLIENT_SECRET),
  { message: 'GOOGLE_CLIENT_SECRET required when GOOGLE_CLIENT_ID is set', path: ['GOOGLE_CLIENT_SECRET'] }
)
.refine(
  (data) => !(data.GITHUB_CLIENT_ID && !data.GITHUB_CLIENT_SECRET),
  { message: 'GITHUB_CLIENT_SECRET required when GITHUB_CLIENT_ID is set', path: ['GITHUB_CLIENT_SECRET'] }
);

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});
```

### Validation Strategy

- Parse once at module load time (fails fast on import)
- `instrumentation.ts` imports `env` to trigger validation at startup
- In development, skip strict validation unless `VALIDATE_ENV_VARS=true`
- Production: strict validation, application fails to start if invalid

```typescript
function parseEnv() {
  if (process.env.NODE_ENV !== 'production' &&
      process.env.VALIDATE_ENV_VARS !== 'true') {
    // Development: permissive parsing with defaults
    return {
      ...serverEnvSchema.partial().parse(process.env),
      ...clientEnvSchema.parse(process.env),
    };
  }

  // Production: strict validation
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Environment validation failed:\n${formatted}\n\nSee .env.example for configuration.`
    );
  }

  return { ...result.data, ...clientEnvSchema.parse(process.env) };
}

export const env = parseEnv();
export type Env = typeof env;
```

### Usage Pattern

```typescript
// Before
const secret = process.env.JWT_SECRET!;
if (!process.env.RESEND_API_KEY) { ... }

// After
import { env } from '@/lib/env';
const secret = env.JWT_SECRET;  // typed, guaranteed in production
if (!env.RESEND_API_KEY) { ... }
```

### Error Output

Production startup failure example:

```
Environment validation failed:
  - JWT_SECRET: JWT_SECRET must be at least 32 characters
  - DATABASE_URL: DATABASE_URL is required
  - GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET required when GOOGLE_CLIENT_ID is set

See .env.example for configuration.
```

## Migration

### Files to Update

| File | Changes |
|------|---------|
| `src/lib/auth.ts` | Replace `process.env.SESSION_SECRET!`, `process.env.NODE_ENV` |
| `src/lib/auth/oauth/secrets.ts` | Replace `process.env.JWT_SECRET` check, remove manual throw |
| `src/lib/auth/oauth/providers.ts` | Replace `process.env.GOOGLE_*`, `process.env.GITHUB_*` |
| `src/lib/email.ts` | Replace `process.env.RESEND_API_KEY`, `EMAIL_FROM`, etc. |
| `src/lib/db.ts` | Replace `process.env.NODE_ENV` |
| `src/lib/security.ts` | Replace `process.env.JWT_*` |
| `src/middleware.ts` | Replace `process.env.NODE_ENV` |
| `src/instrumentation.ts` | Import `env` to trigger validation |

### Removals

- `src/lib/config/security.ts`: Remove `validateRequiredEnvVars()` and `REQUIRED_ENV_VARS`
- `src/lib/auth/oauth/secrets.ts`: Remove manual `if (!secret) throw` check

### Preserved

- `SECURITY_CONFIG` in `src/lib/config/security.ts` (unrelated)
- `getEnabledProviders()` logic in `oauth/providers.ts`

## Testing

Update `tests/unit/env-validation.spec.ts`:

```typescript
describe('env validation', () => {
  it('should fail when JWT_SECRET is too short');
  it('should fail when DATABASE_URL is missing');
  it('should accept valid configuration');
  it('should allow missing optional vars');
  it('should require CLIENT_SECRET when CLIENT_ID is set');
  it('should skip strict validation in development');
});
```

## Implementation Tasks

1. Create `src/lib/env.ts` with Zod schema
2. Update `src/instrumentation.ts` to use new validation
3. Migrate files to use `env` instead of `process.env`
4. Remove old validation code from `src/lib/config/security.ts`
5. Update tests
6. Update `.env.example` with validation requirements in comments

## Decision Log

- **OAuth stays optional**: Email/password is primary auth; social login is enhancement
- **Development permissive**: Don't block dev workflow with missing optional vars
- **Pair validation**: Warn if OAuth CLIENT_ID set without CLIENT_SECRET
