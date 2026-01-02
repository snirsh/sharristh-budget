# Fix: Missing 'role' Column in invite_codes Table

## Problem
The database is missing the `role` column in the `invite_codes` table, causing invite operations to fail with:
```
The column `invite_codes.role` does not exist in the current database.
```

## Solution
You need to apply the migration to add the missing column. Choose one of the methods below:

### Method 1: Using Prisma CLI (Recommended)
```bash
# If using Vercel Postgres or another hosted database:
# 1. Make sure your DATABASE_URL is set in your environment
# 2. Run:
cd packages/db
pnpm db:push
```

### Method 2: Using the Migration Script
```bash
# Set your DATABASE_URL environment variable, then run:
export DATABASE_URL="your-database-url-here"
node apply-migration.mjs
```

### Method 3: Manual SQL (if you have direct database access)
Connect to your PostgreSQL database and run:
```sql
ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'member';
```

### Method 4: For Vercel deployments
If your app is deployed on Vercel:
1. Go to your Vercel project settings
2. Find your DATABASE_URL in Environment Variables
3. Connect to your database using Vercel's database dashboard or a tool like pgAdmin
4. Run the SQL from Method 3

## Verification
After applying the migration, restart your app and try creating an invite again. The error should be resolved.

## Migration File Locations
- Migration SQL: `packages/db/prisma/migrations/20260102_add_role_to_invite_codes/migration.sql`
- Helper script: `apply-migration.mjs`
