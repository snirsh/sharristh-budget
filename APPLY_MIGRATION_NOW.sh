#!/bin/bash
# Quick migration script for Neon database
# This applies the migration using the SQL file

cat << 'EOF'
=================================================================
QUICK FIX: Apply Migration to Your Neon Database
=================================================================

Your Neon database connection is:
postgresql://neondb_owner:npg_YXNfVOezQ2c5@ep-misty-hall-agtdlw17-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require

OPTION 1: Use Neon Console (Easiest - 30 seconds)
--------------------------------------------------
1. Go to: https://console.neon.tech/
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Copy and paste the SQL below
5. Click "Run" or press Ctrl+Enter

EOF

echo ""
echo "SQL TO RUN:"
echo "==========="
cat packages/db/prisma/migrations/20260102_fix_invite_codes_schema/migration.sql

cat << 'EOF'


OPTION 2: Use psql from your local machine (if you have it installed)
----------------------------------------------------------------------
psql "postgresql://neondb_owner:npg_YXNfVOezQ2c5@ep-misty-hall-agtdlw17-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require" \
  -f packages/db/prisma/migrations/20260102_fix_invite_codes_schema/migration.sql


AFTER APPLYING:
---------------
1. Restart your application
2. Clear browser cache (Ctrl+Shift+R)
3. Try inviting your spouse again!

=================================================================
EOF
