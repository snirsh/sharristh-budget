import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('=== Checking Database Schema ===\n');

    // Check what columns exist in invite_codes table
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'invite_codes'
      ORDER BY ordinal_position;
    `;

    console.log('Current columns in invite_codes table:');
    console.table(columns);

    // Check expected columns
    const expectedColumns = [
      'id', 'code', 'type', 'householdId', 'role',
      'expiresAt', 'usedAt', 'usedByUserId', 'createdByUserId', 'createdAt'
    ];

    const existingColumnNames = columns.map(c => c.column_name);
    const missingColumns = expectedColumns.filter(col => !existingColumnNames.includes(col));

    if (missingColumns.length > 0) {
      console.log('\n❌ Missing columns:');
      missingColumns.forEach(col => console.log(`  - ${col}`));
      console.log('\nYou need to run the migration to add these columns.');
    } else {
      console.log('\n✅ All expected columns are present!');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    if (error.code === 'P1001') {
      console.log('\n💡 Cannot connect to database. Make sure DATABASE_URL is set correctly.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
