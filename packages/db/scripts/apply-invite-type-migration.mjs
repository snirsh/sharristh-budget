#!/usr/bin/env node
/**
 * Migration Script: Add 'type' column to invite_codes table
 *
 * This script applies the migration to add the missing 'type' column
 * to the invite_codes table in your Neon database.
 *
 * Usage:
 *   DATABASE_URL="your-connection-string" node packages/db/scripts/apply-invite-type-migration.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('\nUsage:');
    console.error('  DATABASE_URL="your-connection-string" node packages/db/scripts/apply-invite-type-migration.mjs');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read the migration file
    const migrationPath = join(__dirname, '../prisma/migrations/20260102_fix_invite_codes_schema/migration.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('\n📝 Applying migration...');
    console.log('Migration SQL:');
    console.log('─'.repeat(60));
    console.log(migrationSQL);
    console.log('─'.repeat(60));

    // Execute the migration
    await client.query(migrationSQL);

    console.log('\n✅ Migration applied successfully!');
    console.log('\n📊 Verifying the changes...');

    // Verify the columns exist
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'invite_codes'
        AND column_name IN ('type', 'role', 'householdId', 'expiresAt', 'usedAt', 'usedByUserId', 'createdByUserId', 'createdAt')
      ORDER BY column_name;
    `);

    console.log('\n✅ Columns in invite_codes table:');
    console.table(result.rows);

    console.log('\n✨ Migration complete! Your invite system should now work correctly.');
    console.log('\nNext steps:');
    console.log('  1. Restart your application (if running)');
    console.log('  2. Clear your browser cache (Ctrl+Shift+R)');
    console.log('  3. Try creating a partner invite again');

  } catch (error) {
    console.error('\n❌ Error applying migration:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n👋 Database connection closed');
  }
}

applyMigration();
