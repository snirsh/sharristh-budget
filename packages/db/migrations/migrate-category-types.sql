-- Migration to update category types from 'expected'/'varying' to 'expense'
-- This migration updates all existing categories to use the new type system

-- Update all 'expected' categories to 'expense'
UPDATE categories
SET type = 'expense'
WHERE type = 'expected';

-- Update all 'varying' categories to 'expense'
UPDATE categories
SET type = 'expense'
WHERE type = 'varying';

-- Verify the migration
SELECT type, COUNT(*) as count
FROM categories
GROUP BY type;
