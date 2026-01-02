import { PrismaClient } from '@sfam/db/client';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('Applying migration: add role column to invite_codes...');

    // Read the migration SQL
    const migrationPath = path.join(
      __dirname,
      'packages/db/prisma/migrations/20260102_add_role_to_invite_codes/migration.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the raw SQL
    await prisma.$executeRawUnsafe(sql);

    console.log('Migration applied successfully!');
    console.log('The invite_codes table now has a role column.');
  } catch (error) {
    console.error('Failed to apply migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
