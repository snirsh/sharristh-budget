import { describe, it, expect } from 'vitest';
import {
  generateTransactionHash,
  filterNewTransactions,
  groupByAccount,
} from '../../utils/deduplication';
import type { MappedTransaction } from '../../types';

describe('deduplication', () => {
  const createTransaction = (overrides: Partial<MappedTransaction> = {}): MappedTransaction => ({
    externalId: 'ext123',
    date: new Date('2024-01-15'),
    description: 'Test Transaction',
    merchant: 'Test Store',
    amount: 100,
    direction: 'expense',
    notes: null,
    externalAccountId: 'ACC123',
    ...overrides,
  });

  describe('generateTransactionHash', () => {
    it('should generate consistent hash for same transaction', () => {
      const txn = createTransaction();

      const hash1 = generateTransactionHash(txn);
      const hash2 = generateTransactionHash(txn);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it('should generate different hash for different amounts', () => {
      const txn1 = createTransaction({ amount: 100 });
      const txn2 = createTransaction({ amount: 200 });

      expect(generateTransactionHash(txn1)).not.toBe(generateTransactionHash(txn2));
    });

    it('should generate different hash for different dates', () => {
      const txn1 = createTransaction({ date: new Date('2024-01-15') });
      const txn2 = createTransaction({ date: new Date('2024-01-16') });

      expect(generateTransactionHash(txn1)).not.toBe(generateTransactionHash(txn2));
    });

    it('should generate different hash for different accounts', () => {
      const txn1 = createTransaction({ externalAccountId: 'ACC1' });
      const txn2 = createTransaction({ externalAccountId: 'ACC2' });

      expect(generateTransactionHash(txn1)).not.toBe(generateTransactionHash(txn2));
    });

    it('should ignore time portion of date', () => {
      const txn1 = createTransaction({ date: new Date('2024-01-15T10:00:00Z') });
      const txn2 = createTransaction({ date: new Date('2024-01-15T22:00:00Z') });

      expect(generateTransactionHash(txn1)).toBe(generateTransactionHash(txn2));
    });

    it('should be case-insensitive for description', () => {
      const txn1 = createTransaction({ description: 'Test Transaction' });
      const txn2 = createTransaction({ description: 'test transaction' });

      expect(generateTransactionHash(txn1)).toBe(generateTransactionHash(txn2));
    });
  });

  describe('filterNewTransactions', () => {
    it('should filter out existing transactions by external ID', () => {
      const transactions = [
        createTransaction({ externalId: 'ext1' }),
        createTransaction({ externalId: 'ext2' }),
        createTransaction({ externalId: 'ext3' }),
      ];
      const existingIds = new Set(['ext1', 'ext3']);

      const result = filterNewTransactions(transactions, existingIds);

      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe('ext2');
    });

    it('should return all transactions when no existing IDs', () => {
      const transactions = [
        createTransaction({ externalId: 'ext1' }),
        createTransaction({ externalId: 'ext2' }),
      ];
      const existingIds = new Set<string>();

      const result = filterNewTransactions(transactions, existingIds);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when all transactions exist', () => {
      const transactions = [
        createTransaction({ externalId: 'ext1' }),
        createTransaction({ externalId: 'ext2' }),
      ];
      const existingIds = new Set(['ext1', 'ext2']);

      const result = filterNewTransactions(transactions, existingIds);

      expect(result).toHaveLength(0);
    });
  });

  describe('groupByAccount', () => {
    it('should group transactions by account', () => {
      const transactions = [
        createTransaction({ externalAccountId: 'ACC1', externalId: 'ext1' }),
        createTransaction({ externalAccountId: 'ACC2', externalId: 'ext2' }),
        createTransaction({ externalAccountId: 'ACC1', externalId: 'ext3' }),
      ];

      const result = groupByAccount(transactions);

      expect(result.size).toBe(2);
      expect(result.get('ACC1')).toHaveLength(2);
      expect(result.get('ACC2')).toHaveLength(1);
    });

    it('should return empty map for empty transactions', () => {
      const result = groupByAccount([]);
      expect(result.size).toBe(0);
    });
  });
});


