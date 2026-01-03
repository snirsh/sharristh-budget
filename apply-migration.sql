-- Add isProcessing column to Transaction table
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isProcessing" BOOLEAN NOT NULL DEFAULT false;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Transaction' AND column_name = 'isProcessing';
