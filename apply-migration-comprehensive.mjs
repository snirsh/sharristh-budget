import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('=== Applying Comprehensive Migration ===\n');

    // Read the migration SQL
    const migrationPath = join(
      __dirname,
      'packages/db/prisma/migrations/20260102_fix_invite_codes_schema/migration.sql'
    );

    console.log('Reading migration from:', migrationPath);
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('\nApplying migration...');

    // Execute the raw SQL
    await prisma.$executeRawUnsafe(sql);

    console.log('\n✅ Migration applied successfully!');
    console.log('✅ All missing columns have been added to invite_codes table.');

    // Verify by checking columns
    const columns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'invite_codes'
      ORDER BY ordinal_position;
    `;

    console.log('\nCurrent columns in invite_codes:');
    columns.forEach(col => console.log(`  ✓ ${col.column_name}`));

  } catch (error) {
    console.error('\n❌ Failed to apply migration:', error.message);
    if (error.code === 'P1001') {
      console.log('\n💡 Cannot connect to database. Make sure DATABASE_URL is set correctly.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
