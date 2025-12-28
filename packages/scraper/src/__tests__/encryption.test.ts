import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  encryptCredentials,
  decryptCredentials,
  encryptToken,
  decryptToken,
} from '../encryption';

describe('encryption', () => {
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeAll(() => {
    // Set test secret
    process.env.AUTH_SECRET = 'test-secret-key-for-encryption-tests-32chars';
  });

  afterAll(() => {
    // Restore original
    process.env.AUTH_SECRET = originalAuthSecret;
  });

  describe('encryptCredentials / decryptCredentials', () => {
    it('should encrypt and decrypt credentials correctly', () => {
      const credentials = {
        email: 'test@example.com',
        password: 'supersecret123',
        phoneNumber: '+972501234567',
      };

      const encrypted = encryptCredentials(credentials);
      const decrypted = decryptCredentials<typeof credentials>(encrypted);

      expect(decrypted).toEqual(credentials);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const credentials = { email: 'test@example.com', password: 'pass' };

      const encrypted1 = encryptCredentials(credentials);
      const encrypted2 = encryptCredentials(credentials);

      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to the same value
      expect(decryptCredentials(encrypted1)).toEqual(decryptCredentials(encrypted2));
    });

    it('should handle complex nested objects', () => {
      const credentials = {
        user: {
          email: 'test@example.com',
          profile: {
            name: 'Test User',
          },
        },
        password: 'pass123',
        metadata: ['tag1', 'tag2'],
      };

      const encrypted = encryptCredentials(credentials);
      const decrypted = decryptCredentials<typeof credentials>(encrypted);

      expect(decrypted).toEqual(credentials);
    });

    it('should throw on invalid encrypted format', () => {
      expect(() => decryptCredentials('invalid-data')).toThrow('Invalid encrypted credential format');
    });

    it('should throw on tampered ciphertext', () => {
      const credentials = { email: 'test@example.com', password: 'pass' };
      const encrypted = encryptCredentials(credentials);
      
      // Tamper with the ciphertext
      const parts = encrypted.split('.');
      parts[1] = 'tampereddata' + parts[1].substring(12);
      const tampered = parts.join('.');

      expect(() => decryptCredentials(tampered)).toThrow();
    });

    it('should produce correctly formatted output (base64.base64.base64)', () => {
      const credentials = { email: 'test@example.com' };
      const encrypted = encryptCredentials(credentials);

      const parts = encrypted.split('.');
      expect(parts).toHaveLength(3);

      // Each part should be valid base64
      parts.forEach((part) => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      });
    });

    it('should handle Hebrew characters', () => {
      const credentials = {
        description: 'תיאור בעברית',
        merchant: 'שופרסל',
      };

      const encrypted = encryptCredentials(credentials);
      const decrypted = decryptCredentials<typeof credentials>(encrypted);

      expect(decrypted).toEqual(credentials);
    });
  });

  describe('encryptToken / decryptToken', () => {
    it('should encrypt and decrypt tokens correctly', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';

      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });

    it('should handle long tokens', () => {
      const longToken = 'a'.repeat(1000);

      const encrypted = encryptToken(longToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(longToken);
    });
  });

  describe('error handling', () => {
    it('should throw when AUTH_SECRET is not set', () => {
      const savedSecret = process.env.AUTH_SECRET;
      delete process.env.AUTH_SECRET;

      expect(() => encryptCredentials({ test: 'data' })).toThrow(
        'AUTH_SECRET environment variable is required'
      );

      process.env.AUTH_SECRET = savedSecret;
    });
  });
});

