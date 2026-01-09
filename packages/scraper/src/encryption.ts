import crypto from 'crypto';

/**
 * Get the encryption key derived from AUTH_SECRET with domain separation
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required for credential encryption');
  }
  // Domain-separated key derivation
  return crypto
    .createHash('sha256')
    .update(secret + '_bank_creds')
    .digest();
}

/**
 * Encrypt credentials using AES-256-GCM
 * Same pattern as webauthn-utils.ts for consistency
 */
export function encryptCredentials(creds: object): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);

  const encrypted = Buffer.concat([cipher.update(JSON.stringify(creds), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${encrypted.toString('base64')}.${authTag.toString('base64')}`;
}

/**
 * Decrypt credentials using AES-256-GCM
 */
export function decryptCredentials<T>(encrypted: string): T {
  const parts = encrypted.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format');
  }

  const ivB64 = parts[0]!;
  const dataB64 = parts[1]!;
  const tagB64 = parts[2]!;

  const iv = Buffer.from(ivB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Encrypt a single string value (for long-term tokens)
 */
export function encryptToken(token: string): string {
  return encryptCredentials({ token });
}

/**
 * Decrypt a single string value (for long-term tokens)
 */
export function decryptToken(encrypted: string): string {
  const result = decryptCredentials<{ token: string }>(encrypted);
  return result.token;
}
