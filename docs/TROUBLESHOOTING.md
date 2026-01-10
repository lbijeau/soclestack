# Troubleshooting Guide

Common issues and solutions for SocleStack development and deployment.

## Quick Diagnostics

```bash
# Check if database is running
docker-compose ps

# Check environment variables are loaded
npm run dev  # Watch for Zod validation errors at startup

# Check database connection
npx prisma db pull  # Should succeed without errors

# Regenerate Prisma client
npx prisma generate
```

---

## Database Issues

### "Can't reach database server"

**Symptoms:** `Error: Can't reach database server at localhost:5432`

**Solutions:**
1. Start PostgreSQL: `docker-compose up -d`
2. Wait a few seconds for container to be ready
3. Verify it's running: `docker-compose ps` (should show "Up")

### "Database does not exist"

**Symptoms:** `error: database "soclestack" does not exist`

**Solutions:**
```bash
# Create database and run migrations
npx prisma db push

# Or if using migrations
npx prisma migrate dev
```

### "Prisma Client not generated"

**Symptoms:** `@prisma/client did not initialize yet` or import errors

**Solutions:**
```bash
npx prisma generate
```

### Schema drift / migration issues

**Symptoms:** `Drift detected: Your database schema is not in sync`

**Solutions:**
```bash
# Development: Reset and resync
npx prisma db push --force-reset

# Production: Create migration
npx prisma migrate dev --name describe_changes
```

---

## Environment Variable Issues

### "Missing required environment variable"

**Symptoms:** Zod validation error at startup listing missing variables

**Solutions:**
1. Copy example file: `cp .env.example .env.local`
2. Fill in required values (see `docs/ENVIRONMENT.md`)
3. Required variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `SESSION_SECRET` - 32+ character random string
   - `JWT_SECRET` - 32+ character random string

### Generate secure secrets

```bash
# Generate a secure random secret
openssl rand -base64 32
```

### "Invalid DATABASE_URL format"

**Symptoms:** Prisma connection errors

**Solution:** Use format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

```bash
# Local Docker
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/soclestack"

# With connection pooling (Supabase, Neon)
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true"
```

---

## Authentication Issues

### "Invalid CSRF token"

**Symptoms:** 403 errors on form submissions

**Causes & Solutions:**
1. **Cookies blocked:** Ensure cookies are enabled, check SameSite settings
2. **Token expired:** Refresh the page to get new token
3. **Cross-origin request:** API must be same origin or configure CORS

### "Session expired" immediately after login

**Symptoms:** User logged out right after logging in

**Causes & Solutions:**
1. **Clock skew:** Ensure server and client clocks are synchronized
2. **Cookie not set:** Check browser dev tools > Application > Cookies
3. **HTTPS mismatch:** In production, ensure `NEXTAUTH_URL` uses HTTPS

### Login works but user shows as unauthenticated

**Symptoms:** Login succeeds but `/api/auth/me` returns 401

**Solutions:**
1. Check cookies are being sent (credentials: 'include')
2. Verify SESSION_SECRET hasn't changed between requests
3. Check for proxy stripping cookies (X-Forwarded-* headers)

---

## OAuth Issues

### "OAuth callback error"

**Symptoms:** Redirect to error page after OAuth provider authorization

**Causes & Solutions:**
1. **Callback URL mismatch:** Provider callback must exactly match:
   - Google: `http://localhost:3000/api/auth/oauth/google/callback`
   - GitHub: `http://localhost:3000/api/auth/oauth/github/callback`
2. **Missing credentials:** Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.
3. **State token expired:** OAuth must complete within 10 minutes

### "Account already linked"

**Symptoms:** Error when trying to link OAuth account

**Solution:** Each OAuth account can only link to one user. Check if already linked to another account.

### OAuth works locally but not in production

**Checklist:**
- [ ] Update callback URLs in provider console to production domain
- [ ] Set `NEXTAUTH_URL` to production URL
- [ ] Ensure HTTPS is configured
- [ ] Update OAuth credentials for production

---

## Two-Factor Authentication Issues

### "Invalid 2FA code"

**Symptoms:** TOTP code rejected during login or setup

**Causes & Solutions:**
1. **Clock drift:** TOTP is time-based. Sync device clock with internet time
2. **Code expired:** Codes are valid for 30 seconds. Enter quickly
3. **Wrong account:** Verify authenticator app has correct account

### Lost access to authenticator app

**Solutions:**
1. Use one of the 10 backup codes provided during setup
2. Ask admin to reset 2FA: `POST /api/admin/users/[id]/reset-2fa`
3. Each backup code works once only

### QR code not scanning

**Solutions:**
1. Try manual entry - use the text code shown below QR
2. Increase screen brightness
3. Try different authenticator app (Google Authenticator, Authy, 1Password)

---

## Rate Limiting Issues

### "Too many requests" (429)

**Symptoms:** API returns 429 status code

**Solutions:**
1. **Wait:** Rate limits reset after the window (usually 1 minute)
2. **Check headers:** `X-RateLimit-Reset` shows when limit resets
3. **Development:** Reset limits via `POST /api/test/reset-rate-limits`

### Rate limits too aggressive

**Configuration:** Edit `src/lib/rate-limiter/index.ts` or set environment:
```bash
# Use Redis for distributed rate limiting
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

---

## Email Issues

### Emails not sending in development

**Expected behavior:** In development without `RESEND_API_KEY`, emails log to console instead of sending.

**To test real emails:**
1. Sign up at [resend.com](https://resend.com)
2. Get API key and set `RESEND_API_KEY`
3. Verify your sending domain

### "Email delivery failed"

**Check:**
1. Email logs: `GET /api/admin/emails` (admin only)
2. Resend dashboard for delivery status
3. Spam folders for test emails

### Email verification link expired

**Solution:** Request new verification email:
- Click "Resend verification email" on login page
- Or call `POST /api/auth/resend-verification`

---

## Build & TypeScript Issues

### "Type error" during build

**Symptoms:** `npm run build` fails with TypeScript errors

**Solutions:**
```bash
# Check types without building
npx tsc --noEmit

# Common fix: regenerate Prisma types
npx prisma generate
```

### "Module not found" errors

**Solutions:**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules && npm install

# Regenerate Prisma client
npx prisma generate
```

### ESLint errors blocking commit

**Solutions:**
```bash
# Auto-fix what's possible
npm run lint -- --fix

# Check specific file
npx eslint src/path/to/file.ts
```

---

## Development Server Issues

### Port 3000 already in use

**Solutions:**
```bash
# Find process using port
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### Hot reload not working

**Solutions:**
1. Check file isn't in `.gitignore` (ignored files don't trigger reload)
2. Restart dev server: `Ctrl+C` then `npm run dev`
3. Clear Next.js cache: `rm -rf .next`

---

## Production Deployment Issues

### "NEXTAUTH_URL must be set"

**Solution:** Set to your production URL:
```bash
NEXTAUTH_URL="https://your-domain.com"
```

### Database connection timeouts

**Solutions:**
1. Use connection pooling (PgBouncer, Supabase pooler)
2. Add `?connection_limit=1` to DATABASE_URL for serverless
3. Configure pool settings in Prisma schema

### Static assets not loading

**Check:**
1. `next.config.js` basePath if using subpath
2. CDN configuration for `/_next/static/` paths
3. CORS headers for cross-origin asset loading

---

## Getting Help

If your issue isn't listed here:

1. **Search existing issues:** [GitHub Issues](https://github.com/lbijeau/soclestack/issues)
2. **Check documentation:** [Full Docs](https://lbijeau.github.io/soclestack/)
3. **Open new issue:** Include error messages, steps to reproduce, and environment details

### Useful debug information to include

```bash
# System info
node --version
npm --version

# Check dependencies
npm ls prisma
npm ls next

# Environment (don't share secrets!)
cat .env.local | grep -v SECRET | grep -v PASSWORD | grep -v KEY
```
