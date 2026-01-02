-- AlterTable: Add all missing columns to invite_codes table
-- This handles the case where the database schema is out of sync

-- Add 'type' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'type'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'global';
    END IF;
END $$;

-- Add 'role' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'role'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member';
    END IF;
END $$;

-- Add 'householdId' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'householdId'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "householdId" TEXT;
    END IF;
END $$;

-- Add 'expiresAt' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'expiresAt'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "expiresAt" TIMESTAMP(3);
    END IF;
END $$;

-- Add 'usedAt' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'usedAt'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "usedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Add 'usedByUserId' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'usedByUserId'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "usedByUserId" TEXT;
    END IF;
END $$;

-- Add 'createdByUserId' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'createdByUserId'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "createdByUserId" TEXT;
    END IF;
END $$;

-- Add 'createdAt' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
