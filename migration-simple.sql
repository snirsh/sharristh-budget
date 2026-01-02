-- Simple Migration: Just update category types
-- Run this in Neon SQL Editor if you only want to update types without replacing categories

BEGIN;

-- Update all 'expected' categories to 'expense'
UPDATE categories
SET type = 'expense'
WHERE type = 'expected';

-- Update all 'varying' categories to 'expense'
UPDATE categories
SET type = 'expense'
WHERE type = 'varying';

-- Verify the results
SELECT
    type,
    COUNT(*) as count
FROM categories
GROUP BY type
ORDER BY type;

COMMIT;

-- Expected output should show only 'income' and 'expense' types
