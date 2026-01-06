/*
  Warnings:

  - You are about to drop the column `role` on the `organization_invites` table. All the data in the column will be lost.
  - You are about to drop the column `organization_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `organization_role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - Added the required column `role_id` to the `organization_invites` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."users" DROP CONSTRAINT "users_organization_id_fkey";

-- DropIndex
DROP INDEX "public"."users_organization_id_idx";

-- AlterTable
ALTER TABLE "public"."organization_invites" DROP COLUMN "role",
ADD COLUMN     "role_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "organization_id",
DROP COLUMN "organization_role",
DROP COLUMN "role";

-- DropEnum
DROP TYPE "public"."OrganizationRole";

-- DropEnum
DROP TYPE "public"."Role";

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "public"."user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "public"."user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_roles_organization_id_idx" ON "public"."user_roles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_organization_id_key" ON "public"."user_roles"("user_id", "role_id", "organization_id");

-- Partial unique index for platform-wide roles (organizationId IS NULL)
-- Required because Postgres treats NULL != NULL in unique constraints
CREATE UNIQUE INDEX "user_roles_user_role_platform_unique"
ON "public"."user_roles" ("user_id", "role_id")
WHERE "organization_id" IS NULL;

-- AddForeignKey
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
