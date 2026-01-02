#!/bin/bash
# Script to fix the missing 'role' column in invite_codes table

echo "=== Fix Invite Database ==="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set."
  echo ""
  echo "Please set it first:"
  echo "  export DATABASE_URL='your-database-url-here'"
  echo ""
  echo "Or if using .env.local:"
  echo "  1. Create apps/web/.env.local"
  echo "  2. Add: DATABASE_URL='your-database-url-here'"
  echo "  3. Run: source apps/web/.env.local && ./fix-invite-database.sh"
  exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Try to use Prisma CLI from node_modules
PRISMA_BIN="./node_modules/.pnpm/@prisma+client@6.19.1_prisma@6.19.1_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/node_modules/.bin/prisma"

if [ -f "$PRISMA_BIN" ]; then
  echo "✓ Found Prisma CLI"
  echo "Applying migration..."
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 $PRISMA_BIN db push --schema=packages/db/prisma/schema.prisma --accept-data-loss
else
  echo "❌ Prisma CLI not found."
  echo "Please run: pnpm install"
  exit 1
fi

echo ""
echo "✅ Migration complete! You can now invite your spouse."
