-- AlterTable
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "defaultPasswordExpiresAt" TIMESTAMP(3);
