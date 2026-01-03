#!/bin/bash

# Script to apply the isProcessing column migration
# Run this with: bash apply-db-migration.sh

echo "Applying database migration to add isProcessing column..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set."
    echo ""
    echo "Please run this script with your DATABASE_URL:"
    echo "  DATABASE_URL='your-connection-string' bash apply-db-migration.sh"
    echo ""
    echo "Or export it first:"
    echo "  export DATABASE_URL='your-connection-string'"
    echo "  bash apply-db-migration.sh"
    exit 1
fi

# Apply the migration
echo "Connecting to database..."
psql "$DATABASE_URL" -f apply-migration.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo "The isProcessing column has been added to the Transaction table."
    echo ""
    echo "Your site should now load without errors."
else
    echo ""
    echo "❌ Migration failed. Please check your DATABASE_URL and try again."
    exit 1
fi
