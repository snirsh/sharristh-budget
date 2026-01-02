#!/bin/bash
# Script to fix the missing columns in invite_codes table

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
  echo "  1. Create apps/web/.env.local or .env.local in root"
  echo "  2. Add: DATABASE_URL='your-database-url-here'"
  echo "  3. Run: source .env.local && ./fix-invite-database.sh"
  exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# First, check the current state of the database
echo "Step 1: Checking current database schema..."
node check-database.mjs
echo ""

# Ask user to confirm
read -p "Do you want to apply the migration? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Migration cancelled."
  exit 0
fi

# Apply the comprehensive migration
echo "Step 2: Applying migration..."
node apply-migration-comprehensive.mjs

echo ""
echo "✅ Migration complete! You can now invite your spouse."
