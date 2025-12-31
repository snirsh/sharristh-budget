import { PrismaClient } from '@sfam/db';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking invite codes in database...\n');

  const invites = await prisma.inviteCode.findMany({
    select: {
      id: true,
      code: true,
      createdAt: true,
      usedAt: true,
      usedByUserId: true,
    },
  });

  console.log(`Found ${invites.length} invite code(s):\n`);

  invites.forEach((invite, index) => {
    console.log(`${index + 1}. ID: ${invite.id}`);
    console.log(`   Code (hashed): ${invite.code}`);
    console.log(`   Created: ${invite.createdAt}`);
    console.log(`   Used: ${invite.usedAt ? invite.usedAt : 'Not used'}`);
    console.log(`   Used by: ${invite.usedByUserId || 'N/A'}`);
    console.log('');
  });

  // Show hash function for testing
  console.log('\nTo hash a code for testing:');
  console.log('crypto.createHash("sha256").update(YOUR_CODE).digest("hex")');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
