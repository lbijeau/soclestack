-- AddColumn: email_verification_token to users table
ALTER TABLE "users" ADD COLUMN "email_verification_token" TEXT;

-- AddColumn: email_verification_expires to users table
ALTER TABLE "users" ADD COLUMN "email_verification_expires" DATETIME;
