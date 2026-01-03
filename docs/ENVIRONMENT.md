# Environment Variables Guide

**Status**: Current
**Last Updated**: 2026-01-03
**Maintainer**: Development Team

Complete reference for all environment variables used in the SocleStack application.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Required Variables](#required-variables)
- [Optional Variables](#optional-variables)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Security Best Practices](#security-best-practices)
- [Validation](#validation)
- [Troubleshooting](#troubleshooting)
- [Reference](#reference)

---

## Quick Start

### 1. Copy the Example File

```bash
cp .env.example .env
```

### 2. Generate Secrets

```bash
# Generate SESSION_SECRET (32+ characters)
openssl rand -base64 32

# Generate JWT_SECRET (32+ characters)
openssl rand -base64 32

# Generate JWT_REFRESH_SECRET (32+ characters)
openssl rand -base64 32
```

### 3. Configure Database

For **SQLite** (development):
```env
DATABASE_URL="file:./prisma/dev.db"
```

For **PostgreSQL** (production):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/soclestack"
```

### 4. Configure Email (Production Only)

```env
RESEND_API_KEY="re_your_api_key_here"
EMAIL_FROM="noreply@yourdomain.com"
```

---

## Required Variables

These variables **must** be set for the application to function.

### Core Application

| Variable | Required | Description | Example | Where Used |
|----------|----------|-------------|---------|------------|
| `DATABASE_URL` | ✅ Yes | Prisma database connection string | `postgresql://user:pass@host:5432/db` | All database operations |
| `SESSION_SECRET` | ✅ Yes | Secret for encrypting session cookies (32+ chars) | `your-very-long-secret-key-here` | `src/lib/auth.ts` |
| `JWT_SECRET` | ✅ Yes | Secret for signing JWT access tokens (32+ chars) | `your-jwt-secret-key-here` | `src/lib/security.ts` |
| `JWT_REFRESH_SECRET` | ✅ Yes | Secret for signing JWT refresh tokens (32+ chars) | `your-refresh-secret-key-here` | `src/lib/security.ts` |

**⚠️ Critical**: All secrets MUST be:
- At least 32 characters long
- Randomly generated (use `openssl rand -base64 32`)
- Different from each other
- Never committed to version control

---

## Optional Variables

These variables have defaults or are only needed for specific features.

### Email Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | Production only | `null` | Resend API key for sending emails |
| `EMAIL_FROM` | No | `noreply@soclestack.com` | Sender email address |

**Behavior**:
- **Development**: Emails logged to console (no API key needed)
- **Production**: Requires `RESEND_API_KEY` or emails will fail

**Setup**:
1. Sign up at [resend.com](https://resend.com)
2. Generate an API key
3. Add to `.env`: `RESEND_API_KEY="re_your_key"`
4. Configure sender: `EMAIL_FROM="noreply@yourdomain.com"`

### OAuth Providers

Configure only if you're enabling social login.

**Google OAuth**:
```env
OAUTH_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
OAUTH_GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

**GitHub OAuth**:
```env
OAUTH_GITHUB_CLIENT_ID="your-github-client-id"
OAUTH_GITHUB_CLIENT_SECRET="your-github-client-secret"
```

**Setup Instructions**:
- Google: [Create OAuth credentials](https://console.cloud.google.com/apis/credentials)
- GitHub: [Create OAuth app](https://github.com/settings/developers)

### Application Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Node.js environment (`development`, `production`, `test`) |
| `BASE_URL` | No | `http://localhost:3000` | Application base URL for links/redirects |
| `PORT` | No | `3000` | Port for development server |

### Feature Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_EMAIL_VERIFICATION` | boolean | `true` | Require email verification on signup |
| `ENABLE_TWO_FACTOR_AUTH` | boolean | `false` | Enable 2FA for all users |
| `ENABLE_SOCIAL_LOGIN` | boolean | `true` | Enable OAuth social login |

**Usage**:
```env
ENABLE_EMAIL_VERIFICATION=true
ENABLE_TWO_FACTOR_AUTH=false
ENABLE_SOCIAL_LOGIN=true
```

### File Upload Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UPLOAD_MAX_SIZE` | No | `10485760` | Max file size in bytes (10MB) |
| `UPLOAD_ALLOWED_TYPES` | No | `image/jpeg,image/png,image/gif,application/pdf` | Allowed MIME types |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | No | `900000` | Time window in ms (15 min) |

### Redis (Distributed Rate Limiting)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UPSTASH_REDIS_REST_URL` | No | - | Upstash Redis REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | No | - | Upstash Redis REST API token |

**Behavior**:
- If both variables are set, Redis-based rate limiting is used (recommended for production)
- If not set, falls back to in-memory rate limiting (single-instance only)

**Setup**:
1. Sign up at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the REST URL and token from the dashboard
4. Add to `.env`:
   ```env
   UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="AXxxxx..."
   ```

**When to use Redis**:
- Multiple application instances (horizontal scaling)
- Serverless deployments (Vercel, Cloudflare Workers)
- Need consistent rate limiting across instances

---

## Environment-Specific Configuration

### Development (`.env.local`)

```env
# Core
DATABASE_URL="file:./prisma/dev.db"
SESSION_SECRET="dev-session-secret-32-chars-min"
JWT_SECRET="dev-jwt-secret-32-chars-minimum"
JWT_REFRESH_SECRET="dev-refresh-secret-32-chars-min"

# Node Environment
NODE_ENV=development

# Email (logged to console, no API key needed)
EMAIL_FROM="dev@soclestack.local"

# Feature Flags
ENABLE_EMAIL_VERIFICATION=false
ENABLE_TWO_FACTOR_AUTH=false
ENABLE_SOCIAL_LOGIN=false
```

### Production (`.env.production`)

```env
# Core - MUST USE STRONG SECRETS
DATABASE_URL="postgresql://soclestack_user:STRONG_PASSWORD@db.example.com:5432/soclestack_prod"
SESSION_SECRET="<generated-with-openssl-rand-base64-32>"
JWT_SECRET="<generated-with-openssl-rand-base64-32>"
JWT_REFRESH_SECRET="<generated-with-openssl-rand-base64-32>"

# Node Environment
NODE_ENV=production

# Application
BASE_URL="https://yourdomain.com"

# Email - REQUIRED
RESEND_API_KEY="re_prod_api_key_here"
EMAIL_FROM="noreply@yourdomain.com"

# OAuth (if enabled)
OAUTH_GOOGLE_CLIENT_ID="prod-client-id.apps.googleusercontent.com"
OAUTH_GOOGLE_CLIENT_SECRET="prod-client-secret"
OAUTH_GITHUB_CLIENT_ID="prod-github-client-id"
OAUTH_GITHUB_CLIENT_SECRET="prod-github-secret"

# Feature Flags
ENABLE_EMAIL_VERIFICATION=true
ENABLE_TWO_FACTOR_AUTH=true
ENABLE_SOCIAL_LOGIN=true

# Security
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

### Testing (`.env.test`)

```env
# Test Database (separate from development)
DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/soclestack_test"
TEST_DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/soclestack_e2e_test"

# Test Secrets (can be simple since not production)
SESSION_SECRET="test-session-secret-min-32-chars"
JWT_SECRET="test-jwt-secret-minimum-32-chars"
JWT_REFRESH_SECRET="test-refresh-secret-minimum-32"

# Node Environment
NODE_ENV=test

# Email Testing
EMAIL_SERVICE_URL="http://localhost:8025"
SMTP_HOST="localhost"
SMTP_PORT=1025

# Test Data Seeds
SEED_ADMIN_EMAIL="admin@test.com"
SEED_ADMIN_PASSWORD="AdminTest123!"
SEED_USER_EMAIL="user@test.com"
SEED_USER_PASSWORD="UserTest123!"
```

---

## Security Best Practices

### 1. Secret Generation

**✅ DO:**
```bash
# Use cryptographically secure random generation
openssl rand -base64 32
# Or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**❌ DON'T:**
```env
# Weak, predictable secrets
SESSION_SECRET="my-secret"
JWT_SECRET="password123"
```

### 2. Secret Rotation

Rotate secrets regularly, especially:
- After security incidents
- When team members leave
- Every 90 days (recommended)

**How to rotate safely:**
1. Generate new secrets
2. Update in production environment
3. Restart application
4. Monitor for session/auth issues
5. Update backup/DR configurations

### 3. Environment Isolation

**Never** share secrets across environments:
- ❌ Using production secrets in development
- ❌ Using same DATABASE_URL for dev/test/prod
- ❌ Committing ANY secrets to git

**Best practice**:
```
Development   → Weak secrets OK (local only)
Staging       → Production-like secrets
Production    → Strong, rotated secrets
```

### 4. Database Credentials

**Development (SQLite)**:
```env
DATABASE_URL="file:./prisma/dev.db"
```

**Production (PostgreSQL)**:
```env
# Use strong passwords and restricted users
DATABASE_URL="postgresql://soclestack_app:STRONG_RANDOM_PASSWORD@db-host:5432/soclestack"
```

**Security checklist**:
- ✅ Unique database user per application
- ✅ Strong random password (16+ characters)
- ✅ Restricted permissions (app user can't DROP DATABASE)
- ✅ Connection encryption (SSL/TLS)
- ✅ IP whitelist for database access

### 5. OAuth Secrets

- Store `CLIENT_SECRET` values securely
- Use separate OAuth apps for dev/staging/prod
- Rotate OAuth credentials if compromised
- Configure redirect URIs strictly (no wildcards)

---

## Validation

### Runtime Validation

The application validates required environment variables on startup:

```typescript
// Automatic validation (throws error if missing)
const sessionOptions = {
  password: process.env.SESSION_SECRET!, // Will throw if undefined
  // ...
};

// Manual validation with error handling
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}
```

### Pre-deployment Checklist

Before deploying, verify:

```bash
# Check all required variables are set
[ -n "$DATABASE_URL" ] && echo "✅ DATABASE_URL" || echo "❌ DATABASE_URL missing"
[ -n "$SESSION_SECRET" ] && echo "✅ SESSION_SECRET" || echo "❌ SESSION_SECRET missing"
[ -n "$JWT_SECRET" ] && echo "✅ JWT_SECRET" || echo "❌ JWT_SECRET missing"
[ -n "$JWT_REFRESH_SECRET" ] && echo "✅ JWT_REFRESH_SECRET" || echo "❌ JWT_REFRESH_SECRET missing"

# Production-specific checks
if [ "$NODE_ENV" = "production" ]; then
  [ -n "$RESEND_API_KEY" ] && echo "✅ RESEND_API_KEY" || echo "⚠️  RESEND_API_KEY missing (emails will fail)"
  [ -n "$BASE_URL" ] && echo "✅ BASE_URL" || echo "⚠️  BASE_URL not set"
fi
```

---

## Troubleshooting

### Common Issues

#### 1. "JWT_SECRET is not defined"

**Error**: Application crashes on startup

**Solution**:
```bash
# Add to .env
JWT_SECRET="$(openssl rand -base64 32)"
```

#### 2. "Prisma Client could not connect to database"

**Error**: Database connection fails

**Debug steps**:
1. Check `DATABASE_URL` format:
   - SQLite: `file:./prisma/dev.db`
   - PostgreSQL: `postgresql://user:pass@host:5432/db`
2. Verify database exists: `psql $DATABASE_URL` (PostgreSQL)
3. Check database permissions
4. Run migrations: `npx prisma db push`

#### 3. Emails not sending (production)

**Error**: Email operations fail silently

**Debug**:
```bash
# Check if RESEND_API_KEY is set
echo $RESEND_API_KEY

# Verify API key is valid
curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "'"$EMAIL_FROM"'",
    "to": "test@example.com",
    "subject": "Test",
    "text": "Test email"
  }'
```

#### 4. OAuth login fails

**Error**: "Invalid client" or redirect errors

**Checklist**:
- ✅ `OAUTH_*_CLIENT_ID` and `OAUTH_*_CLIENT_SECRET` both set
- ✅ Redirect URI matches OAuth provider configuration
- ✅ OAuth app is enabled (not suspended)
- ✅ Correct environment (dev vs prod credentials)

#### 5. Session expires immediately

**Error**: Users logged out on every request

**Causes**:
- `SESSION_SECRET` changed (invalidates all sessions)
- Cookie `secure` flag in development (HTTPS required)
- Cookie `sameSite` conflicts with iframe/cross-origin

**Solution**:
```env
# Development (HTTP allowed)
NODE_ENV=development

# Production (HTTPS enforced)
NODE_ENV=production
```

---

## Reference

### Variable Priority

Next.js loads environment variables in this order (later overrides earlier):

1. `.env` - Shared across all environments
2. `.env.local` - Local overrides (gitignored)
3. `.env.development` / `.env.production` / `.env.test` - Environment-specific
4. `.env.development.local` / `.env.production.local` / `.env.test.local` - Local + environment-specific

**Example**:
```
.env                  → DATABASE_URL="file:./dev.db"
.env.local           → DATABASE_URL="file:./my-local.db"  # Wins!
```

### Built-in Next.js Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Automatically set by Next.js (`development`, `production`, `test`) |
| `NEXT_PUBLIC_*` | Exposed to browser (use sparingly, never for secrets) |

### Variable Prefixes

- `NEXT_PUBLIC_*` → Exposed to client-side code (⚠️ Never use for secrets)
- No prefix → Server-side only (✅ Safe for secrets)

### Files to Ignore in Git

```gitignore
# Local environment files (in your .gitignore)
.env
.env.local
.env.*.local
.env.postgres

# Keep templates
!.env.example
```

---

## Complete Variable List

### Alphabetical Reference

| Variable | Required | Default | Type | Description |
|----------|----------|---------|------|-------------|
| `BASE_URL` | No | `http://localhost:3000` | string | Application base URL |
| `DATABASE_URL` | ✅ Yes | - | string | Prisma database connection |
| `EMAIL_FROM` | No | `noreply@soclestack.com` | string | Email sender address |
| `EMAIL_SERVICE_URL` | Test only | - | string | Email service URL (testing) |
| `ENABLE_EMAIL_VERIFICATION` | No | `true` | boolean | Require email verification |
| `ENABLE_SOCIAL_LOGIN` | No | `true` | boolean | Enable OAuth login |
| `ENABLE_TWO_FACTOR_AUTH` | No | `false` | boolean | Enable 2FA |
| `JWT_REFRESH_SECRET` | ✅ Yes | - | string | JWT refresh token secret |
| `JWT_SECRET` | ✅ Yes | - | string | JWT access token secret |
| `NODE_ENV` | No | `development` | string | Node environment |
| `OAUTH_GITHUB_CLIENT_ID` | OAuth only | - | string | GitHub OAuth client ID |
| `OAUTH_GITHUB_CLIENT_SECRET` | OAuth only | - | string | GitHub OAuth secret |
| `OAUTH_GOOGLE_CLIENT_ID` | OAuth only | - | string | Google OAuth client ID |
| `OAUTH_GOOGLE_CLIENT_SECRET` | OAuth only | - | string | Google OAuth secret |
| `PORT` | No | `3000` | number | Development server port |
| `RATE_LIMIT_MAX` | No | `100` | number | Max requests per window |
| `RATE_LIMIT_WINDOW` | No | `900000` | number | Rate limit window (ms) |
| `RESEND_API_KEY` | Prod only | - | string | Resend email API key |
| `SEED_ADMIN_EMAIL` | Test only | - | string | Test admin email |
| `SEED_ADMIN_PASSWORD` | Test only | - | string | Test admin password |
| `SEED_USER_EMAIL` | Test only | - | string | Test user email |
| `SEED_USER_PASSWORD` | Test only | - | string | Test user password |
| `SESSION_SECRET` | ✅ Yes | - | string | Session encryption secret |
| `SMTP_HOST` | Test only | - | string | SMTP server host |
| `SMTP_PORT` | Test only | - | number | SMTP server port |
| `TEST_DATABASE_URL` | Test only | - | string | E2E test database URL |
| `TEST_ENV` | Test only | - | string | Test environment identifier |
| `UPLOAD_ALLOWED_TYPES` | No | `image/jpeg,image/png,image/gif,application/pdf` | string | Allowed file MIME types |
| `UPLOAD_MAX_SIZE` | No | `10485760` | number | Max file size (bytes) |
| `UPSTASH_REDIS_REST_TOKEN` | No | - | string | Upstash Redis REST API token |
| `UPSTASH_REDIS_REST_URL` | No | - | string | Upstash Redis REST API URL |

---

## Related Documentation

- [Getting Started](./PROGRESS.md) - Project setup and progress
- [Security Considerations](./TECHNICAL_ARCHITECTURE.md#_8-security-considerations) - Security best practices
- [Database Documentation](./DATABASE.md) - Database schema and setup
- [Email Notifications Design](./plans/2025-11-30-email-notifications-design.md) - Email configuration

---

## Changelog

- **2026-01-01**: Initial comprehensive environment variables documentation
  - Documented all 28 environment variables
  - Added security best practices
  - Added troubleshooting guide
  - Added validation examples
