# Database Migrations Guide

**Status**: Current
**Last Updated**: 2026-01-01
**ORM**: Prisma 6.16.1
**Supported Databases**: SQLite (dev), PostgreSQL (prod)

Complete guide for managing database schema changes with Prisma Migrate.

---

## Table of Contents

- [Overview](#overview)
- [Quick Reference](#quick-reference)
- [Development Workflow](#development-workflow)
- [Production Workflow](#production-workflow)
- [Creating Migrations](#creating-migrations)
- [Applying Migrations](#applying-migrations)
- [Rolling Back Migrations](#rolling-back-migrations)
- [Migration History](#migration-history)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Common Scenarios](#common-scenarios)

---

## Overview

### What are Migrations?

Migrations are version-controlled database schema changes that allow you to:
- Track schema evolution over time
- Apply changes consistently across environments
- Collaborate with team members safely
- Roll back changes if needed

### Migration Tools

Prisma Migrate provides:
- **Schema Definition**: Define your database in `prisma/schema.prisma`
- **Migration Generation**: Automatically generate SQL migrations
- **Migration Application**: Apply migrations to databases
- **Migration History**: Track applied migrations
- **Rollback Support**: Undo migrations when needed

### File Structure

```
prisma/
├── schema.prisma          # Source of truth for database schema
├── dev.db                 # SQLite database (development)
├── dev.db-journal         # SQLite journal file
└── migrations/            # Migration history
    ├── migration_lock.toml    # Prevents concurrent migrations
    ├── 20250101120000_initial_schema/
    │   └── migration.sql      # SQL for this migration
    ├── 20250115140000_add_2fa/
    │   └── migration.sql
    └── 20250120160000_add_organizations/
        └── migration.sql
```

---

## Quick Reference

### Common Commands

| Command | Environment | Purpose |
|---------|-------------|---------|
| `npx prisma migrate dev` | Development | Create + apply migration |
| `npx prisma migrate dev --name <name>` | Development | Named migration |
| `npx prisma migrate deploy` | Production | Apply pending migrations |
| `npx prisma migrate status` | Any | View migration status |
| `npx prisma migrate reset` | Development | Reset database + reapply all |
| `npx prisma db push` | Development | Sync schema without migration |
| `npx prisma generate` | Any | Regenerate Prisma Client |
| `npx prisma studio` | Any | Visual database browser |

### Workflow Comparison

| Task | Development | Production |
|------|-------------|------------|
| **Create migration** | `migrate dev` | ❌ Never |
| **Apply migration** | `migrate dev` (auto) | `migrate deploy` |
| **Test changes** | `db push` | ❌ Never |
| **Reset database** | `migrate reset` | ❌ Never |
| **Seed data** | `npm run db:seed` | Manual or deploy script |

---

## Development Workflow

### Initial Setup

```bash
# 1. Set up environment
cp .env.example .env

# 2. Configure database URL (.env)
DATABASE_URL="file:./prisma/dev.db"  # SQLite for development

# 3. Apply existing migrations
npx prisma migrate deploy

# 4. Generate Prisma Client
npx prisma generate

# 5. Seed database (optional)
npm run db:seed
```

### Making Schema Changes

**Step-by-step workflow**:

```bash
# 1. Edit prisma/schema.prisma
# Add/modify models, fields, relations, etc.

# 2. Create and apply migration
npx prisma migrate dev --name add_feature_name

# 3. Review generated SQL (optional)
cat prisma/migrations/<timestamp>_add_feature_name/migration.sql

# 4. Test your changes
npm run dev

# 5. Commit migration files
git add prisma/migrations
git add prisma/schema.prisma
git commit -m "feat: add feature_name to database schema"
```

### Prototyping (No Migration)

When experimenting, use `db push` instead of `migrate dev`:

```bash
# Push schema changes without creating migration
npx prisma db push

# ⚠️ Warning: This is for prototyping only!
# - No migration file created
# - Can cause data loss
# - Don't use in production
```

**Use `db push` when**:
- Rapid prototyping
- Experimenting with schema
- Don't care about migration history yet

**Switch to `migrate dev` when**:
- Ready to commit changes
- Need migration for team/production
- Want version control

---

## Production Workflow

### Deploying Migrations

**Step-by-step production deployment**:

```bash
# 1. Pull latest code with migrations
git pull origin main

# 2. Install dependencies
npm install

# 3. Check migration status
npx prisma migrate status

# Output shows:
# - Applied migrations (✓)
# - Pending migrations (→)
# - Failed migrations (✗)

# 4. Apply pending migrations
npx prisma migrate deploy

# 5. Regenerate Prisma Client (if needed)
npx prisma generate

# 6. Restart application
pm2 restart soclestack
```

### Pre-Deployment Checklist

Before running migrations in production:

- [ ] ✅ Migrations tested in staging environment
- [ ] ✅ Database backup completed
- [ ] ✅ Downtime window scheduled (if needed)
- [ ] ✅ Rollback plan prepared
- [ ] ✅ Team notified of deployment
- [ ] ✅ Monitoring alerts configured
- [ ] ✅ `DATABASE_URL` points to production database

### Zero-Downtime Migrations

For migrations that might lock tables or take time:

**Approach 1: Expand-Contract Pattern**

```bash
# Phase 1: Expand (add new column, nullable)
# - Add column as nullable
# - Deploy code that writes to both old and new
# - Backfill data

# Phase 2: Contract (remove old column)
# - Deploy code that only uses new column
# - Remove old column
```

**Approach 2: Blue-Green Deployment**

```bash
# 1. Deploy new version to "green" environment
# 2. Run migrations on green database
# 3. Switch traffic to green
# 4. Keep blue as fallback
```

---

## Creating Migrations

### Auto-Generated Migrations

Prisma generates SQL based on schema changes:

```bash
# Create migration with descriptive name
npx prisma migrate dev --name add_api_keys

# ✓ Created migration: 20250101120000_add_api_keys
# ✓ Applied migration to database
# ✓ Generated Prisma Client
```

**Generated migration SQL**:

```sql
-- prisma/migrations/20250101120000_add_api_keys/migration.sql

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "expires_at" DATETIME,
    "last_used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" DATETIME,
    CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");
```

### Manual Migrations

Sometimes you need to write custom SQL:

```bash
# 1. Create empty migration
npx prisma migrate dev --create-only --name custom_indexes

# 2. Edit generated migration file
# prisma/migrations/<timestamp>_custom_indexes/migration.sql

-- Add custom indexes
CREATE INDEX CONCURRENTLY "audit_logs_created_at_category_idx"
  ON "audit_logs" ("created_at", "category");

-- Add custom constraints
ALTER TABLE "users"
  ADD CONSTRAINT "email_format_check"
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

# 3. Apply migration
npx prisma migrate dev
```

### Migration Naming

**Good names** (imperative, descriptive):
```bash
add_api_keys
remove_deprecated_fields
add_organization_invites
add_audit_log_indexes
rename_user_status
```

**Bad names** (vague, unhelpful):
```bash
update
fix
changes
migration
v2
```

---

## Applying Migrations

### Development

```bash
# Apply all pending migrations + generate client
npx prisma migrate dev

# Apply with specific name
npx prisma migrate dev --name add_feature

# Skip generation (faster)
npx prisma migrate dev --skip-generate

# Skip seeding
npx prisma migrate dev --skip-seed
```

### Production

```bash
# Apply pending migrations only (safe for prod)
npx prisma migrate deploy

# ⚠️ This command:
# - Only applies pending migrations
# - Does NOT create new migrations
# - Does NOT reset database
# - Safe for production use
```

### Staging

```bash
# Same as production
npx prisma migrate deploy

# Verify status
npx prisma migrate status
```

---

## Rolling Back Migrations

### Important Notes

⚠️ **Prisma does not have automatic rollback**. You must manually handle rollbacks.

### Rollback Strategies

**Strategy 1: Create Reverse Migration**

```bash
# If migration added a column, create new migration to remove it
npx prisma migrate dev --name rollback_add_column

# Edit schema.prisma to remove the field
# Prisma will generate DROP COLUMN SQL
```

**Strategy 2: Restore from Backup**

```bash
# 1. Stop application
pm2 stop soclestack

# 2. Restore database from backup
pg_restore -d soclestack backup.dump

# 3. Mark migrations as applied (if needed)
# Edit prisma/_internals/migrations/

# 4. Restart application
pm2 start soclestack
```

**Strategy 3: Manual SQL Rollback**

```sql
-- If you added a table
DROP TABLE "api_keys";

-- If you added a column
ALTER TABLE "users" DROP COLUMN "new_field";

-- If you modified a column
ALTER TABLE "users" ALTER COLUMN "email" TYPE VARCHAR(255);

-- Then update migration history
DELETE FROM "_prisma_migrations" WHERE migration_name = '20250101120000_add_api_keys';
```

### Rollback Checklist

- [ ] ✅ Database backup available
- [ ] ✅ Reverse SQL script prepared and tested
- [ ] ✅ Application downtime acceptable
- [ ] ✅ Team notified
- [ ] ✅ Data migration plan (if data was transformed)

---

## Migration History

### Viewing Migration Status

```bash
npx prisma migrate status

# Output examples:

# All migrations applied
✓ All migrations have been applied

# Pending migrations
→ Pending migrations:
  • 20250101120000_add_api_keys

# Failed migration
✗ Failed migration:
  • 20250101120000_add_api_keys
  Error: column "new_field" does not exist
```

### Migration Metadata

Prisma tracks migrations in `_prisma_migrations` table:

```sql
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC;

-- Columns:
-- id                 Migration ID
-- checksum           Migration file hash
-- finished_at        When applied
-- migration_name     Migration directory name
-- logs              Application logs
-- rolled_back_at    Rollback timestamp
-- started_at        Start timestamp
-- applied_steps_count  SQL statements applied
```

### Viewing Migration SQL

```bash
# View specific migration
cat prisma/migrations/20250101120000_add_api_keys/migration.sql

# View all migrations
find prisma/migrations -name "migration.sql" -exec cat {} \;

# Count migrations
ls -l prisma/migrations | grep -c "^d"
```

---

## Troubleshooting

### "Migration failed to apply"

**Error**: Migration fails partway through

**Solutions**:

```bash
# 1. Check migration status
npx prisma migrate status

# 2. Mark failed migration as rolled back
npx prisma migrate resolve --rolled-back <migration_name>

# 3. Fix issue and reapply
npx prisma migrate deploy

# Alternative: Reset (development only)
npx prisma migrate reset
```

### "Schema drift detected"

**Error**: Database schema doesn't match prisma/schema.prisma

**Cause**: Manual database changes or `db push` used

**Solutions**:

```bash
# Option 1: Create migration to match database
npx prisma migrate dev --name sync_schema

# Option 2: Reset database to match schema (dev only)
npx prisma migrate reset

# Option 3: Update schema to match database
npx prisma db pull
```

### "Migration already applied"

**Error**: Prisma thinks migration is pending but it's applied

**Solution**:

```bash
# Mark migration as applied without running it
npx prisma migrate resolve --applied <migration_name>
```

### "Prisma Client outdated"

**Error**: Prisma Client doesn't match schema

**Solution**:

```bash
# Regenerate Prisma Client
npx prisma generate

# Or use migrate dev (regenerates automatically)
npx prisma migrate dev
```

### "Cannot connect to database"

**Error**: Migration fails due to connection issues

**Debug steps**:

```bash
# 1. Check DATABASE_URL
echo $DATABASE_URL

# 2. Test connection
npx prisma db execute --stdin <<< "SELECT 1;"

# 3. Verify database exists
psql $DATABASE_URL -c "SELECT version();"

# 4. Check network/firewall
ping db-host
telnet db-host 5432
```

---

## Best Practices

### 1. Never Edit Applied Migrations

❌ **DON'T**:
```bash
# Edit existing migration file
vim prisma/migrations/20250101_old/migration.sql
```

✅ **DO**:
```bash
# Create new migration
npx prisma migrate dev --name fix_previous_migration
```

**Reason**: Changing applied migrations breaks checksum validation and causes "drift" errors.

### 2. Test Migrations Before Production

```bash
# 1. Create migration in development
npx prisma migrate dev --name add_feature

# 2. Test in staging
DATABASE_URL=<staging-url> npx prisma migrate deploy

# 3. Verify application works in staging
npm run test

# 4. Deploy to production
DATABASE_URL=<prod-url> npx prisma migrate deploy
```

### 3. Use Descriptive Migration Names

```bash
# Good
npx prisma migrate dev --name add_2fa_backup_codes
npx prisma migrate dev --name add_audit_log_indexes
npx prisma migrate dev --name remove_deprecated_user_fields

# Bad
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
npx prisma migrate dev --name migration
```

### 4. Commit Migrations with Code

```bash
# Always commit together
git add prisma/schema.prisma
git add prisma/migrations
git add src/models/user.ts  # Code using new schema
git commit -m "feat: add API keys feature"
```

### 5. Backup Before Major Migrations

```bash
# PostgreSQL backup
pg_dump -Fc soclestack > backup_$(date +%Y%m%d_%H%M%S).dump

# SQLite backup
cp prisma/dev.db prisma/dev.db.backup
```

### 6. Review Generated SQL

Always review auto-generated SQL before applying:

```bash
# Create migration without applying
npx prisma migrate dev --create-only --name add_feature

# Review SQL
cat prisma/migrations/<timestamp>_add_feature/migration.sql

# If OK, apply
npx prisma migrate dev
```

### 7. Use Transactions

Migrations run in transactions by default. For custom SQL:

```sql
BEGIN;

-- Your changes
ALTER TABLE users ADD COLUMN new_field TEXT;
UPDATE users SET new_field = 'default';
ALTER TABLE users ALTER COLUMN new_field SET NOT NULL;

COMMIT;
```

### 8. Handle Data Migrations Carefully

When transforming data:

```sql
-- Add new column (nullable)
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Migrate data
UPDATE users SET full_name = first_name || ' ' || last_name;

-- Make required (after backfill)
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- Remove old columns (in separate migration)
-- ALTER TABLE users DROP COLUMN first_name;
-- ALTER TABLE users DROP COLUMN last_name;
```

---

## Common Scenarios

### Adding a New Model

```prisma
// 1. Edit prisma/schema.prisma
model ApiKey {
  id        String   @id @default(cuid())
  userId    String
  name      String
  keyHash   String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("api_keys")
}

// 2. Add relation to User model
model User {
  // ... existing fields
  apiKeys ApiKey[]
}
```

```bash
# 3. Create migration
npx prisma migrate dev --name add_api_keys

# Generated SQL creates table, indexes, foreign keys
```

### Adding a Column

```prisma
model User {
  // ... existing fields
  phoneNumber String? @map("phone_number")  // Add this
}
```

```bash
npx prisma migrate dev --name add_phone_number

# Generated SQL:
# ALTER TABLE "users" ADD COLUMN "phone_number" TEXT;
```

### Modifying a Column

```prisma
model User {
  email String  // Was: email String @unique
  // Removing unique constraint
}
```

```bash
npx prisma migrate dev --name remove_email_unique

# Generated SQL:
# DROP INDEX "users_email_key";
```

### Adding an Index

```prisma
model AuditLog {
  // ... existing fields

  @@index([userId, createdAt])  // Add composite index
  @@index([action])  // Add this
}
```

```bash
npx prisma migrate dev --name add_audit_log_indexes
```

### Renaming a Field

```prisma
model User {
  displayName String @map("username")  // Renamed from 'username'
}
```

⚠️ **Warning**: Renaming generates DROP + ADD, losing data!

**Safe approach**:

```bash
# 1. Add new field
# 2. Migrate data: UPDATE users SET display_name = username;
# 3. Drop old field
```

### Changing Database Provider

**From SQLite to PostgreSQL**:

```bash
# 1. Update datasource in schema.prisma
datasource db {
  provider = "postgresql"  # was "sqlite"
  url      = env("DATABASE_URL")
}

# 2. Update DATABASE_URL in .env
DATABASE_URL="postgresql://user:pass@localhost:5432/soclestack"

# 3. Create baseline migration
npx prisma migrate dev --name init_postgresql

# 4. Migrate data (custom script needed)
# 5. Verify schema
npx prisma migrate status
```

---

## Related Documentation

- [Database Schema](./DATABASE.md) - Complete schema reference
- [Environment Variables](./ENVIRONMENT.md) - Database connection configuration
- [Getting Started](./PROGRESS.md) - Project setup and progress

---

## Changelog

- **2026-01-01**: Initial database migrations guide
  - Complete Prisma Migrate workflow
  - Development vs production workflows
  - Troubleshooting guide
  - Best practices and common scenarios
  - Rollback strategies
