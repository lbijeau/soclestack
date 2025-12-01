# OAuth/Social Login Design

**Date:** 2025-11-30
**Status:** In Progress

## Overview

Add Google and GitHub OAuth login with account linking support to SocleStack.

## Requirements

### Providers
- Google OAuth 2.0
- GitHub OAuth

### Account Linking Strategy
1. **New OAuth user (email not in system)**:
   - Create new account
   - Requires organization creation OR invite token (same as password registration)

2. **Email matches existing account**:
   - Prompt user to verify with password before linking
   - After verification, link OAuth provider to existing account

3. **Already linked OAuth account**:
   - Log user in directly
   - Respect 2FA if enabled

### Organization Integration
- OAuth registration follows same flow as password registration
- Must create an organization OR use an invite token
- Keeps multi-tenant model consistent

## Database Schema

### New Model: OAuthAccount

```prisma
model OAuthAccount {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider        String   // "google" | "github"
  providerAccountId String @map("provider_account_id")
  email           String?  // Email from OAuth provider
  accessToken     String?  @map("access_token")
  refreshToken    String?  @map("refresh_token")
  tokenExpiresAt  DateTime? @map("token_expires_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@map("oauth_accounts")
}
```

### User Model Updates
```prisma
model User {
  // ... existing fields
  password        String?  // Make nullable for OAuth-only users
  oauthAccounts   OAuthAccount[]
}
```

## OAuth Flow

### 1. Login with OAuth (Existing Account)

```
User clicks "Login with Google"
  → Redirect to Google OAuth
  → Google redirects back with code
  → Exchange code for tokens
  → Get user profile (email, name)
  → Check OAuthAccount table
    → Found: Log user in (respect 2FA if enabled)
    → Not found: Check if email exists in User table
      → Exists: Prompt for password to link accounts
      → Not exists: Redirect to OAuth registration page
```

### 2. OAuth Registration (New Account)

```
User arrives at /auth/oauth/complete
  → Show form with pre-filled name/email from OAuth
  → Require: Organization name OR invite token
  → Create User + OAuthAccount in transaction
  → Log user in
```

### 3. Link OAuth to Existing Account (from Profile)

```
User goes to Profile → Security
  → Clicks "Link Google Account"
  → Redirect to Google OAuth
  → Get OAuth profile
  → Check if provider+id already linked to another account
    → Yes: Error "This account is already linked"
    → No: Create OAuthAccount record
  → Success
```

### 4. Password Verification Flow (Email Match)

```
OAuth callback finds email exists but no OAuthAccount link
  → Store OAuth data in temporary JWT (5 min expiry)
  → Redirect to /auth/oauth/link
  → User enters password
  → Verify password
  → Create OAuthAccount record
  → Log user in
```

## API Endpoints

### OAuth Flow
- `GET /api/auth/oauth/[provider]` - Initiate OAuth (redirect to provider)
- `GET /api/auth/oauth/[provider]/callback` - Handle OAuth callback
- `POST /api/auth/oauth/complete` - Complete OAuth registration (new user)
- `POST /api/auth/oauth/link` - Link OAuth to existing account (with password)

### Profile Management
- `GET /api/auth/oauth/accounts` - List linked OAuth accounts
- `DELETE /api/auth/oauth/accounts/[provider]` - Unlink OAuth account

## UI Pages

### New Pages
- `/auth/oauth/complete` - Complete OAuth registration (org creation)
- `/auth/oauth/link` - Link OAuth to existing account (password verification)

### Modified Pages
- `/login` - Add "Login with Google" and "Login with GitHub" buttons
- `/register` - Add OAuth options
- `/profile/security` - Show linked OAuth accounts, allow linking/unlinking

## Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# App URL for callbacks
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Security Considerations

1. **State Parameter**: Use CSRF token in OAuth state parameter
2. **Token Storage**: Store OAuth tokens encrypted (or don't store access tokens if not needed)
3. **Email Verification**: Trust OAuth provider's email verification
4. **Linking Security**: Always require password before linking to prevent account takeover
5. **Audit Logging**: Log all OAuth events (login, link, unlink)

## Audit Events

- `AUTH_OAUTH_LOGIN_SUCCESS` - OAuth login successful
- `AUTH_OAUTH_LOGIN_FAILED` - OAuth login failed
- `AUTH_OAUTH_ACCOUNT_LINKED` - OAuth account linked
- `AUTH_OAUTH_ACCOUNT_UNLINKED` - OAuth account unlinked
- `AUTH_OAUTH_REGISTRATION` - New user via OAuth

## Implementation Stages

### Stage 1: Database & OAuth Library
- Add OAuthAccount model to Prisma schema
- Make User.password nullable
- Create OAuth helper library with provider configs
- Add state/CSRF handling

### Stage 2: OAuth Flow Endpoints
- Implement `/api/auth/oauth/[provider]` (initiate)
- Implement `/api/auth/oauth/[provider]/callback` (handle callback)
- Add Google provider
- Add GitHub provider

### Stage 3: Registration & Linking
- Implement OAuth registration page
- Implement password verification linking page
- Handle organization creation/invite acceptance

### Stage 4: Profile Management
- Add OAuth accounts list to profile/security
- Implement link/unlink from profile
- Ensure users with only OAuth cannot unlink their last provider

### Stage 5: UI Integration
- Add OAuth buttons to login page
- Add OAuth buttons to register page
- Update security settings page

## OAuth Provider Details

### Google
- Scopes: `openid email profile`
- Auth URL: `https://accounts.google.com/o/oauth2/v2/auth`
- Token URL: `https://oauth2.googleapis.com/token`
- User Info URL: `https://www.googleapis.com/oauth2/v3/userinfo`

### GitHub
- Scopes: `user:email read:user`
- Auth URL: `https://github.com/login/oauth/authorize`
- Token URL: `https://github.com/login/oauth/access_token`
- User Info URL: `https://api.github.com/user`
- Emails URL: `https://api.github.com/user/emails`
