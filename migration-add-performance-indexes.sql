-- Performance Optimization Migration
-- This adds composite indexes for common query patterns to improve loading performance

-- Transactions table indexes
-- Skip ignored transactions and filter by date
CREATE INDEX IF NOT EXISTS "transactions_householdId_isIgnored_date_idx" ON "transactions"("householdId", "isIgnored", "date");

-- Review page queries
CREATE INDEX IF NOT EXISTS "transactions_householdId_needsReview_idx" ON "transactions"("householdId", "needsReview");

-- Category filtering with date range
CREATE INDEX IF NOT EXISTS "transactions_householdId_categoryId_date_idx" ON "transactions"("householdId", "categoryId", "date");

-- Budgets table indexes
-- Month-based budget lookups
CREATE INDEX IF NOT EXISTS "budgets_householdId_month_idx" ON "budgets"("householdId", "month");

-- Categories table indexes
-- Active category filtering by type
CREATE INDEX IF NOT EXISTS "categories_householdId_isActive_type_idx" ON "categories"("householdId", "isActive", "type");

-- Verify indexes were created
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN ('transactions', 'budgets', 'categories')
    AND indexname LIKE '%householdId%'
ORDER BY tablename, indexname;
