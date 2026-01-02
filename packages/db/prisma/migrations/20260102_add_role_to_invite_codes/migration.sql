-- AlterTable: Add role column to invite_codes if it doesn't exist
-- This handles the case where the database was created before the role column was added

-- For PostgreSQL
ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'member';
