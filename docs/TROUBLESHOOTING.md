# Troubleshooting Guide

Common issues and their solutions when developing with SocleStack.

## Table of Contents

- [Environment & Configuration](#environment--configuration)
- [Database Issues](#database-issues)
- [Authentication Problems](#authentication-problems)
- [OAuth Issues](#oauth-issues)
- [Build & Development](#build--development)
- [Testing](#testing)

---

## Environment & Configuration

### Environment validation failed

**Error:**
```
Environment validation failed:
  - JWT_SECRET: JWT_SECRET must be at least 32 characters
```

**Cause:** Required environment variables are missing or invalid.

**Solution:**
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Generate secure secrets:
   ```bash
   # Generate a 32+ character secret
   openssl rand -base64 32
   ```
3. Update `.env` with real values for:
   - `JWT_SECRET` (min 32 chars)
   - `JWT_REFRESH_SECRET` (min 32 chars)
   - `SESSION_SECRET` (min 32 chars)
   - `DATABASE_URL`

### GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set

**Cause:** OAuth provider partially configured.

**Solution:** Either:
- Set both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, OR
- Remove both variables if not using Google OAuth

Same applies for GitHub OAuth credentials.

### Changes to .env not taking effect

**Cause:** Next.js caches environment variables.

**Solution:**
1. Stop the dev server (Ctrl+C)
2. Clear Next.js cache:
   ```bash
   rm -rf .next
   ```
3. Restart:
   ```bash
   npm run dev
   ```

---

## Database Issues

### Database connection failed

**Error:**
```
PrismaClientInitializationError: Can't reach database server
```

**Solution for SQLite (development):**
1. Ensure `DATABASE_URL` is set:
   ```env
   DATABASE_URL="file:./dev.db"
   ```
2. Push the schema:
   ```bash
   npx prisma db push
   ```

**Solution for PostgreSQL (production):**
1. Verify connection string format:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
   ```
2. Check database is accessible from your network
3. Verify credentials are correct

### Prisma schema out of sync

**Error:**
```
The database schema is not in sync with the Prisma schema
```

**Solution:**
```bash
# Development - push changes directly
npx prisma db push

# Production - create and apply migration
npx prisma migrate dev --name your_migration_name
```

### "prisma generate" needed

**Error:**
```
@prisma/client did not initialize yet
```

**Solution:**
```bash
npx prisma generate
```

---

## Authentication Problems

### Session not persisting after login

**Possible causes:**

1. **Cookies not being set**
   - Check browser dev tools → Application → Cookies
   - Ensure `SESSION_SECRET` is set in `.env`

2. **Domain mismatch**
   - In development, use `localhost:3000`
   - Cookie domain must match the request origin

3. **HTTPS required in production**
   - Secure cookies require HTTPS
   - Use a reverse proxy with SSL in production

### "Invalid access token" or "Invalid refresh token"

**Cause:** Token expired or secret changed.

**Solution:**
1. Clear browser cookies
2. Log out and log back in
3. If you changed `JWT_SECRET` or `JWT_REFRESH_SECRET`, all existing tokens are invalidated - users must re-authenticate

### Account locked after failed login attempts

**Cause:** 5 failed login attempts trigger a 15-minute lockout.

**Solution:**
- Wait 15 minutes for automatic unlock, OR
- Admin can unlock via API:
  ```bash
  curl -X POST http://localhost:3000/api/users/{userId}/unlock \
    -H "Authorization: Bearer {admin_token}"
  ```

### 2FA code not working

**Possible causes:**

1. **Time sync issue**
   - TOTP codes are time-based
   - Ensure device clock is accurate (within 30 seconds)

2. **Wrong authenticator app**
   - Ensure you're using the correct account in your authenticator

3. **Backup codes**
   - Use a backup code if TOTP isn't working
   - Each backup code can only be used once

---

## OAuth Issues

### OAuth callback error

**Error:**
```
OAuth callback failed: invalid_grant
```

**Causes & Solutions:**

1. **Expired authorization code**
   - OAuth codes expire quickly (usually 10 minutes)
   - Try the OAuth flow again

2. **Redirect URI mismatch**
   - Ensure callback URL matches exactly in provider settings:
     - Google: `http://localhost:3000/api/auth/oauth/google/callback`
     - GitHub: `http://localhost:3000/api/auth/oauth/github/callback`

3. **Wrong credentials**
   - Verify `CLIENT_ID` and `CLIENT_SECRET` match provider dashboard

### "User already exists" during OAuth signup

**Cause:** Email from OAuth provider already registered with password.

**Solution:**
- Log in with existing password
- Link OAuth account from Profile → Security

### OAuth state token expired

**Error:**
```
OAuth state token expired or invalid
```

**Cause:** Took too long to complete OAuth flow (>15 minutes).

**Solution:** Start the OAuth flow again.

---

## Build & Development

### Build fails with type errors

**Solution:**
```bash
# Check types without building
npx tsc --noEmit

# Fix auto-fixable issues
npm run lint -- --fix
```

### "Module not found" errors

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma client
npx prisma generate
```

### Hot reload not working

**Possible causes:**

1. **File watcher limit reached (Linux)**
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

2. **Cache corruption**
   ```bash
   rm -rf .next
   npm run dev
   ```

### Port 3000 already in use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

---

## Testing

### Unit tests failing after schema changes

**Solution:**
```bash
# Regenerate Prisma client
npx prisma generate

# Run tests
npm run test:unit
```

### E2E tests timing out

**Possible causes:**

1. **Dev server not running**
   - E2E tests need the app running
   - Start dev server in another terminal

2. **Database not seeded**
   - Ensure test data exists
   - Check test setup scripts

### Test database conflicts

**Solution:** Use separate database for tests:
```env
# .env.test
DATABASE_URL="file:./test.db"
```

---

## Still Stuck?

1. **Check the logs**
   - Browser console for client errors
   - Terminal output for server errors

2. **Search existing issues**
   - [GitHub Issues](https://github.com/lbijeau/soclestack/issues)

3. **Create a new issue**
   - Include error message
   - Steps to reproduce
   - Environment details (OS, Node version)

4. **Security issues**
   - See [SECURITY.md](../SECURITY.md)
   - Do not post security vulnerabilities publicly
