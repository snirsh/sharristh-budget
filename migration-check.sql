-- Pre-Migration Check: Run this BEFORE migration to see what will be affected

-- Count households
SELECT 'Total Households' as metric, COUNT(*) as count
FROM households
UNION ALL

-- Count categories by type
SELECT 'Categories: ' || type as metric, COUNT(*) as count
FROM categories
GROUP BY type
UNION ALL

-- Count transactions with categories
SELECT 'Transactions with categories' as metric, COUNT(*) as count
FROM transactions
WHERE "categoryId" IS NOT NULL
UNION ALL

-- Count budgets
SELECT 'Budgets' as metric, COUNT(*) as count
FROM budgets
UNION ALL

-- Count category rules
SELECT 'Category Rules' as metric, COUNT(*) as count
FROM category_rules
UNION ALL

-- Sample of current categories
SELECT 'Sample Categories' as metric, 0 as count;

-- Show some current categories
SELECT
    c.name,
    c.type,
    c.icon,
    COUNT(DISTINCT t.id) as transaction_count
FROM categories c
LEFT JOIN transactions t ON t."categoryId" = c.id
GROUP BY c.id, c.name, c.type, c.icon
ORDER BY transaction_count DESC
LIMIT 10;
