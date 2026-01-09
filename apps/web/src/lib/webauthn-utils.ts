import crypto from 'crypto';
import { cookies } from 'next/headers';

/**
 * Encrypt a challenge for storage in a cookie
 */
function encryptChallenge(challenge: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    crypto.createHash('sha256').update(key).digest(),
    iv
  );
  const encrypted = Buffer.concat([cipher.update(challenge, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${encrypted.toString('base64')}.${authTag.toString('base64')}`;
}

/**
 * Decrypt a challenge from a cookie
 */
function decryptChallenge(encrypted: string, key: string): string | null {
  try {
    const [ivB64, dataB64, tagB64] = encrypted.split('.');
    if (!ivB64 || !dataB64 || !tagB64) return null;

    const iv = Buffer.from(ivB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      crypto.createHash('sha256').update(key).digest(),
      iv
    );
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
  } catch {
    return null;
  }
}

/**
 * Store a challenge in an encrypted cookie
 */
export async function storeChallenge(key: string, challenge: string, ttlMs = 60000) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');

  const encrypted = encryptChallenge(challenge, secret);
  const cookieStore = await cookies();

  cookieStore.set(`webauthn_challenge_${key}`, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: Math.floor(ttlMs / 1000),
    path: '/',
  });
}

/**
 * Get and remove a challenge from the cookie
 */
export async function getAndRemoveChallenge(key: string): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const cookieStore = await cookies();
  const cookieName = `webauthn_challenge_${key}`;
  const encrypted = cookieStore.get(cookieName)?.value;

  if (!encrypted) return null;

  // Delete the cookie
  cookieStore.delete(cookieName);

  return decryptChallenge(encrypted, secret);
}

/**
 * Hash invite code for secure storage/comparison
 */
export function hashInviteCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Get WebAuthn RP (Relying Party) configuration from environment
 */
export function getRPConfig() {
  return {
    rpID: process.env.AUTH_WEBAUTHN_RP_ID || 'localhost',
    rpName: process.env.AUTH_WEBAUTHN_RP_NAME || 'Sharristh Budget',
    origin: process.env.AUTH_WEBAUTHN_RP_ORIGIN || 'http://localhost:3000',
  };
}
