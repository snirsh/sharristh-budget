# Fix: Missing 'type' Column in invite_codes Table

## Problem

When trying to create a partner invite, you're getting this error:

```
[tRPC] Error in invites.createPartnerInvite:
The column `type` does not exist in the current database.
```

## Root Cause

The Prisma schema has been updated to include the `type` and other columns in the `invite_codes` table, but the migration hasn't been applied to your Neon PostgreSQL database yet.

## Solution

Apply the migration to add the missing columns to your database.

### Option 1: Run the Migration Script (Recommended)

We've created an automated migration script that will apply all necessary changes:

```bash
# From the root of the project
DATABASE_URL="your-database-url" pnpm --filter @sfam/db db:migrate:invite-type
```

**Where to get your DATABASE_URL:**
- Check your Vercel environment variables
- Or check your `.env.local` file in `apps/web/`
- Or check the `APPLY_MIGRATION_NOW.sh` file (it contains the connection string)

### Option 2: Use Neon Console (Quick - 30 seconds)

1. Go to https://console.neon.tech/
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Copy and paste this SQL:

```sql
-- Add 'type' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'type'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'global';
    END IF;
END $$;

-- Add 'role' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'role'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member';
    END IF;
END $$;

-- Add 'householdId' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'householdId'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "householdId" TEXT;
    END IF;
END $$;

-- Add 'expiresAt' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'expiresAt'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "expiresAt" TIMESTAMP(3);
    END IF;
END $$;

-- Add 'usedAt' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'usedAt'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "usedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Add 'usedByUserId' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'usedByUserId'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "usedByUserId" TEXT;
    END IF;
END $$;

-- Add 'createdByUserId' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'createdByUserId'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "createdByUserId" TEXT;
    END IF;
END $$;

-- Add 'createdAt' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE "invite_codes" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
```

5. Click "Run" or press Ctrl+Enter

### Option 3: Use psql (If you have it installed)

```bash
# Get your DATABASE_URL from Vercel or .env.local, then:
psql "YOUR_DATABASE_URL" \
  -f packages/db/prisma/migrations/20260102_fix_invite_codes_schema/migration.sql
```

## After Applying the Migration

1. If your application is running, restart it
2. Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)
3. Try creating a partner invite again
4. It should work now! ✨

## What This Migration Does

This migration adds the following columns to the `invite_codes` table:

- **`type`**: Distinguishes between "global" and "household" invites (required)
- **`role`**: Specifies the role for household invites ("owner" or "member")
- **`householdId`**: Links household invites to a specific household
- **`expiresAt`**: Optional expiration timestamp
- **`usedAt`**: Timestamp when the invite was used
- **`usedByUserId`**: ID of the user who used the invite
- **`createdByUserId`**: ID of the user who created the invite
- **`createdAt`**: Timestamp when the invite was created

All columns are added with `IF NOT EXISTS` checks, so it's safe to run multiple times.

## Troubleshooting

### Error: "Database connection failed"

Make sure your DATABASE_URL is correct and includes the connection pooling suffix if using Neon.

### Error: "Permission denied"

Make sure you're using a database user with ALTER TABLE privileges.

### Still getting the error after migration?

1. Verify the migration was applied by checking the invite_codes table in Neon Console
2. Make sure you've restarted your application
3. Clear your browser cache completely
4. Check for any other running instances of the application

## Need Help?

If you continue to have issues, please check:
1. The migration file: `packages/db/prisma/migrations/20260102_fix_invite_codes_schema/migration.sql`
2. The Prisma schema: `packages/db/prisma/schema.prisma`
3. Your DATABASE_URL environment variable
