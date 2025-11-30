# Two-Factor Authentication Design

**Date:** 2025-11-30
**Status:** Approved
**Scope:** TOTP-based 2FA with backup codes and admin reset

## Overview

Add TOTP-based two-factor authentication to SocleStack:
- **Required for ADMIN role**, optional for USER and MODERATOR
- **Recovery**: Backup codes (10 one-time codes) + admin reset as fallback
- **UI location**: `/profile/security` page

**Dependencies to add:**
- `otpauth` - TOTP generation/validation
- `qrcode` - QR code generation for authenticator setup

## Database Schema

Add to User model:

```prisma
model User {
  // ... existing fields ...

  twoFactorSecret    String?   @map("two_factor_secret")
  twoFactorEnabled   Boolean   @default(false) @map("two_factor_enabled")
  twoFactorVerified  Boolean   @default(false) @map("two_factor_verified")
  backupCodes        BackupCode[]
}

model BackupCode {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash  String    @map("code_hash")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@map("backup_codes")
}
```

**Field explanations:**
- `twoFactorSecret`: Encrypted TOTP secret for generating codes
- `twoFactorEnabled`: Whether 2FA is active for this user
- `twoFactorVerified`: True after first successful code entry (prevents lockout from abandoned setup)
- `BackupCode.codeHash`: bcrypt hashed backup code
- `BackupCode.usedAt`: Timestamp when code was consumed (one-time use)

## Setup Flow

1. User navigates to `/profile/security`
2. Clicks "Enable Two-Factor Authentication"
3. `POST /api/auth/2fa/setup` generates:
   - Random TOTP secret (stored encrypted in DB)
   - 10 backup codes (hashed and stored, plaintext shown once)
   - QR code data URL for authenticator app
4. UI shows:
   - QR code to scan
   - Manual entry key (for users who can't scan)
   - List of backup codes with "Download" / "Copy" option
   - Warning: "Save these backup codes - you won't see them again"
5. User enters 6-digit code from authenticator to verify
6. `POST /api/auth/2fa/verify` validates code
   - If valid: set `twoFactorEnabled: true`, `twoFactorVerified: true`
   - If invalid: show error, let them retry

**Admin enforcement:**
- When ADMIN logs in without 2FA enabled, redirect to `/profile/security` with banner: "Two-factor authentication is required for admin accounts"
- Block access to admin routes until 2FA is set up

## Login Flow

1. User submits email + password (existing flow)
2. If password valid, check `user.twoFactorEnabled`
   - If `false`: proceed to session creation (existing flow)
   - If `true`: return partial response with `requiresTwoFactor: true`
3. Frontend shows 2FA code input screen
4. User enters 6-digit code (or backup code)
5. `POST /api/auth/2fa/validate` checks:
   - First: try TOTP validation (time-based code)
   - If fails: try backup code match (hash comparison)
   - If backup code used: mark it as consumed (`usedAt = now`)
6. If valid: complete session creation, return tokens
7. If invalid: increment failure count, return error

**State between password and 2FA steps:**
- Store `pendingUserId` in a short-lived session or signed token (5 min expiry)
- Don't create full session until 2FA passes
- This prevents session hijacking if attacker has only the password

**Audit events:**
- `AUTH_2FA_SUCCESS` - code validated
- `AUTH_2FA_FAILURE` - invalid code
- `AUTH_2FA_BACKUP_USED` - backup code consumed (alert user to regenerate)

## Recovery & Admin Reset

**Backup code recovery:**
- User clicks "Use backup code" on 2FA screen
- Enters one of their 10 saved codes
- System hashes input, compares against stored hashes
- If match found and not already used: login succeeds, code marked consumed
- After login: show warning "You have X backup codes remaining" (if ≤3)

**Admin reset flow:**
- Admin navigates to user management, finds locked-out user
- Clicks "Reset 2FA" button
- `POST /api/admin/users/[id]/reset-2fa`
- System sets `twoFactorEnabled: false`, deletes backup codes
- Audit log: `ADMIN_2FA_RESET` with admin ID and target user ID
- User can now login with just password, must re-enable 2FA if admin

**Self-disable:**
- User with 2FA enabled can disable it from `/profile/security`
- Requires entering current TOTP code to confirm
- Admins cannot self-disable (enforced requirement)

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/2fa/setup` | Generate secret, QR code, backup codes |
| POST | `/api/auth/2fa/verify` | Confirm setup with first valid code |
| POST | `/api/auth/2fa/validate` | Validate code during login |
| POST | `/api/auth/2fa/disable` | User disables their own 2FA |
| POST | `/api/admin/users/[id]/reset-2fa` | Admin resets user's 2FA |

## File Structure

**New files:**
```
src/lib/auth/totp.ts                    - TOTP generate/validate helpers
src/lib/auth/backup-codes.ts            - Backup code generation/validation
src/app/api/auth/2fa/setup/route.ts
src/app/api/auth/2fa/verify/route.ts
src/app/api/auth/2fa/validate/route.ts
src/app/api/auth/2fa/disable/route.ts
src/app/api/admin/users/[id]/reset-2fa/route.ts
src/app/(dashboard)/profile/security/page.tsx   - Security settings UI
src/components/auth/two-factor-setup.tsx        - QR + backup codes display
src/components/auth/two-factor-input.tsx        - 6-digit code entry
```

**Modified files:**
```
prisma/schema.prisma              - Add BackupCode model, User 2FA fields
src/app/api/auth/login/route.ts   - Return requiresTwoFactor flag
src/components/auth/login-form.tsx - Handle 2FA step
src/middleware.ts                 - Enforce 2FA for admins
```

## Security Considerations

- TOTP secrets encrypted at rest
- Backup codes bcrypt hashed (same security as passwords)
- Pending 2FA state expires after 5 minutes
- Admin reset creates audit trail
- Backup code usage triggers user notification
- Admins cannot disable their own 2FA
