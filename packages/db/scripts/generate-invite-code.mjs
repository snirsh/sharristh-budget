#!/usr/bin/env node
import crypto from 'crypto';
import { execSync } from 'child_process';

/**
 * Generate a secure invite code and add it to the database
 */

// Generate random code
const code = crypto.randomBytes(16).toString('hex');
const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
const cuid = `cuid-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  INVITE CODE GENERATOR');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Generated invite code:', code);
console.log('Hashed code:', hashedCode);
console.log('ID:', cuid);
console.log('');

// Insert into database
const sql = `INSERT INTO invite_codes (id, code, "createdAt") VALUES ('${cuid}', '${hashedCode}', NOW());`;

try {
  console.log('Adding to database...');
  execSync(
    `pnpm prisma db execute --schema ./prisma/schema.prisma --stdin`,
    {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
      cwd: process.cwd()
    }
  );

  console.log('✅ Invite code successfully added to database!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SHARE THIS CODE WITH THE USER:');
  console.log('  ' + code);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

} catch (error) {
  console.error('❌ Failed to add invite code to database');
  console.error('Error:', error.message);
  console.log('\nYou can manually add it with this SQL:');
  console.log(sql);
  process.exit(1);
}
