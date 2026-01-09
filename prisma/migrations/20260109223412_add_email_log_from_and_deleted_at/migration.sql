-- AlterTable: Add from column with default, then make it required
ALTER TABLE "public"."email_logs" ADD COLUMN "from" TEXT;

-- Set default value for existing rows
UPDATE "public"."email_logs" SET "from" = 'noreply@soclestack.com' WHERE "from" IS NULL;

-- Make column required
ALTER TABLE "public"."email_logs" ALTER COLUMN "from" SET NOT NULL;

-- Add deleted_at column for soft delete (GDPR compliance)
ALTER TABLE "public"."email_logs" ADD COLUMN "deleted_at" TIMESTAMP(3);
