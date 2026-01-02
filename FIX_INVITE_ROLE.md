# Fix: Missing Columns in invite_codes Table

## Problem
The database is missing several columns in the `invite_codes` table, causing invite operations to fail with errors like:
```
The column `invite_codes.role` does not exist in the current database.
The column `type` does not exist in the current database.
```

This indicates your database schema is out of sync with the Prisma schema definition.

## Quick Diagnosis

Run this to check what columns are missing:
```bash
export DATABASE_URL="your-database-url-here"
node check-database.mjs
```

## Solution

Choose the method that works best for your setup:

### Method 1: Automated Fix Script (Recommended)
```bash
# Set your DATABASE_URL environment variable
export DATABASE_URL="your-database-url-here"

# Run the automated fix
./fix-invite-database.sh
```

This script will:
1. Check what columns currently exist
2. Show you what's missing
3. Apply the comprehensive migration
4. Verify the fix

### Method 2: Using Node.js Script Directly
```bash
# Set your DATABASE_URL
export DATABASE_URL="your-database-url-here"

# Check current state
node check-database.mjs

# Apply migration
node apply-migration-comprehensive.mjs
```

### Method 3: Manual SQL (if you have direct database access)
Connect to your PostgreSQL database and run the migration SQL directly:

```bash
# Copy the SQL from:
cat packages/db/prisma/migrations/20260102_fix_invite_codes_schema/migration.sql

# Then run it in your PostgreSQL client
```

The migration adds these columns if they don't exist:
- `type` (TEXT, default 'global')
- `role` (TEXT, default 'member')
- `householdId` (TEXT, nullable)
- `expiresAt` (TIMESTAMP)
- `usedAt` (TIMESTAMP)
- `usedByUserId` (TEXT)
- `createdByUserId` (TEXT)
- `createdAt` (TIMESTAMP, default now)

### Method 4: Using Prisma CLI (Nuclear Option)
```bash
cd packages/db

# This will force the entire schema to match
# WARNING: This might drop data if there are other schema conflicts
pnpm db:push --accept-data-loss
```

### Method 5: For Vercel Deployments
If your app is deployed on Vercel:

1. **Get your DATABASE_URL:**
   - Go to Vercel project → Settings → Environment Variables
   - Copy the `DATABASE_URL` value

2. **Run locally:**
   ```bash
   export DATABASE_URL="the-url-from-vercel"
   ./fix-invite-database.sh
   ```

3. **Or use Vercel's database tools:**
   - Go to Storage → Your Database → Query
   - Paste and run the SQL from `packages/db/prisma/migrations/20260102_fix_invite_codes_schema/migration.sql`

## After Applying the Migration

1. ✅ Restart your application
2. ✅ Clear your browser cache (or do a hard refresh)
3. ✅ Try creating an invite again
4. ✅ The invite system should now work correctly

## Verification

Run the check script to verify all columns are present:
```bash
export DATABASE_URL="your-database-url-here"
node check-database.mjs
```

You should see ✅ All expected columns are present!

## Important Notes

- ✅ Safe to run multiple times (uses `IF NOT EXISTS` checks)
- ✅ Won't drop or modify existing data
- ✅ Only adds missing columns
- ✅ Uses PostgreSQL conditional column additions

## Migration File Locations
- Comprehensive migration: `packages/db/prisma/migrations/20260102_fix_invite_codes_schema/migration.sql`
- Check script: `check-database.mjs`
- Apply script: `apply-migration-comprehensive.mjs`
- Automated fix: `fix-invite-database.sh`
