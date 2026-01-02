-- Add missing 'role' column to invite_codes table
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
