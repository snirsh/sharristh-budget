import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ ERROR: No DATABASE_URL provided.');
  console.error('Usage: node apply-migration.mjs "your-database-url"');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('📝 Applying migration: Add isProcessing column to Transaction table...');

    await client.query(`
      ALTER TABLE "Transaction"
      ADD COLUMN IF NOT EXISTS "isProcessing" BOOLEAN NOT NULL DEFAULT false;
    `);

    console.log('✅ Migration applied successfully!\n');

    // Verify the column exists
    console.log('🔍 Verifying column was added...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'Transaction' AND column_name = 'isProcessing';
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful!');
      console.log('   Column details:', verifyResult.rows[0]);
      console.log('\n🎉 Migration completed! Your site should now load without errors.');
    } else {
      console.log('⚠️  Warning: Could not verify column was added.');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
