import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('Applying migration: add role column to invite_codes...');

    // Read the migration SQL
    const migrationPath = join(
      __dirname,
      'packages/db/prisma/migrations/20260102_add_role_to_invite_codes/migration.sql'
    );
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('SQL to execute:', sql);

    // Execute the raw SQL
    await prisma.$executeRawUnsafe(sql);

    console.log('✓ Migration applied successfully!');
    console.log('✓ The invite_codes table now has a role column.');
  } catch (error) {
    console.error('✗ Failed to apply migration:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
