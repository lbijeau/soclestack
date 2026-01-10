/*
  Warnings:

  - The `status` column on the `email_logs` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."email_status" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- AlterTable
ALTER TABLE "public"."email_logs" DROP COLUMN "status",
ADD COLUMN     "status" "public"."email_status" NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "public"."EmailStatus";

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "public"."email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_deleted_at_idx" ON "public"."email_logs"("deleted_at");
