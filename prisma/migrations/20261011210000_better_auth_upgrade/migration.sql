-- AlterTable
ALTER TABLE "twoFactor" ADD COLUMN IF NOT EXISTS "failedVerificationCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verified" BOOLEAN DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");
