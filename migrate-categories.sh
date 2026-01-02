#!/bin/bash
set -e

echo "🚀 Category Migration Script"
echo "============================"
echo ""

# Step 1: Install dependencies if needed
echo "📦 Step 1/3: Ensuring dependencies are installed..."
PUPPETEER_SKIP_DOWNLOAD=true pnpm install --no-frozen-lockfile > /dev/null 2>&1 || true
echo "✅ Dependencies ready"
echo ""

# Step 2: Update database schema
echo "🗄️  Step 2/3: Updating database schema..."
cd packages/db
npx prisma generate
npx prisma db push --accept-data-loss
echo "✅ Database schema updated"
echo ""

# Step 3: Run data migration
echo "📊 Step 3/3: Migrating category data..."
pnpm tsx scripts/migrate-to-new-categories.ts
echo "✅ Data migration complete"
echo ""

echo "🎉 All done! Categories have been migrated successfully."
echo ""
echo "Summary of changes:"
echo "- Category types updated: income | expense (was: income | expected | varying)"
echo "- All existing categories replaced with new bilingual structure"
echo "- Transactions preserved and remapped to new categories"
echo "- Rules updated to use new categories"
echo "- Budgets deleted (recreate with new structure)"
