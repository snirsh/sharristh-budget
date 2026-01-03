# Database Migration Instructions

## Apply isProcessing Column Migration

The `isProcessing` column needs to be added to the Transaction table.

### Option 1: Using Node.js Script (Recommended)

```bash
cd packages/db
node apply-migration.mjs "your-database-connection-string"
```

### Option 2: Using SQL Directly

Connect to your database and run:

```sql
ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "isProcessing" BOOLEAN NOT NULL DEFAULT false;
```

### Option 3: Using psql

```bash
psql "your-database-connection-string" -f ../../apply-migration.sql
```

### Verifying the Migration

After running the migration, verify the column exists:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Transaction' AND column_name = 'isProcessing';
```

You should see:
- **column_name**: isProcessing
- **data_type**: boolean
- **column_default**: false

Once applied, your site will load without errors!
