import { describe, it, expect } from 'vitest';
import { mapTransaction, mapAccountTransactions } from '../../utils/transaction-mapper';
import type { ScrapedTransaction, ScrapedAccount } from '../../types';

describe('transaction-mapper', () => {
  describe('mapTransaction', () => {
    it('should map a basic expense transaction', () => {
      const txn: ScrapedTransaction = {
        type: 'normal',
        identifier: 'txn123',
        date: '2024-01-15',
        processedDate: '2024-01-16',
        originalAmount: -100,
        originalCurrency: 'ILS',
        chargedAmount: -100,
        chargedCurrency: 'ILS',
        description: 'שופרסל - תל אביב',
        status: 'completed',
      };

      const result = mapTransaction(txn, 'ACC123');

      expect(result.externalId).toBe('ACC123_txn123');
      expect(result.amount).toBe(100);
      expect(result.direction).toBe('expense');
      expect(result.description).toBe('שופרסל - תל אביב');
      expect(result.merchant).toBe('שופרסל');
      expect(result.externalAccountId).toBe('ACC123');
      expect(result.date).toBeInstanceOf(Date);
    });

    it('should map an income transaction', () => {
      const txn: ScrapedTransaction = {
        type: 'normal',
        date: '2024-01-15',
        processedDate: '2024-01-16',
        originalAmount: 5000,
        originalCurrency: 'ILS',
        chargedAmount: 5000,
        description: 'משכורת',
        status: 'completed',
      };

      const result = mapTransaction(txn, 'ACC123');

      expect(result.amount).toBe(5000);
      expect(result.direction).toBe('income');
    });

    it('should handle installment transactions', () => {
      const txn: ScrapedTransaction = {
        type: 'installments',
        identifier: 'inst123',
        date: '2024-01-15',
        processedDate: '2024-01-16',
        originalAmount: -300,
        originalCurrency: 'ILS',
        chargedAmount: -100,
        installments: {
          number: 1,
          total: 3,
        },
        description: 'מקס סטוק',
        status: 'completed',
      };

      const result = mapTransaction(txn, 'ACC123');

      expect(result.notes).toContain('תשלום 1/3');
      expect(result.amount).toBe(100);
    });

    it('should include foreign currency info in notes', () => {
      const txn: ScrapedTransaction = {
        type: 'normal',
        date: '2024-01-15',
        processedDate: '2024-01-16',
        originalAmount: -50,
        originalCurrency: 'USD',
        chargedAmount: -180,
        chargedCurrency: 'ILS',
        description: 'Amazon',
        status: 'completed',
      };

      const result = mapTransaction(txn, 'ACC123');

      expect(result.notes).toContain('-50 USD');
    });

    it('should generate hash-based external ID when no identifier provided', () => {
      const txn: ScrapedTransaction = {
        type: 'normal',
        date: '2024-01-15',
        processedDate: '2024-01-16',
        originalAmount: -100,
        originalCurrency: 'ILS',
        chargedAmount: -100,
        description: 'חנות כלשהי',
        status: 'completed',
      };

      const result = mapTransaction(txn, 'ACC123');

      expect(result.externalId).toMatch(/^ACC123_[a-f0-9]+$/);
    });

    it('should include memo in notes', () => {
      const txn: ScrapedTransaction = {
        type: 'normal',
        date: '2024-01-15',
        processedDate: '2024-01-16',
        originalAmount: -100,
        originalCurrency: 'ILS',
        chargedAmount: -100,
        description: 'חנות',
        memo: 'הערה חשובה',
        status: 'completed',
      };

      const result = mapTransaction(txn, 'ACC123');

      expect(result.notes).toContain('הערה חשובה');
    });
  });

  describe('mapAccountTransactions', () => {
    it('should map transactions from multiple accounts', () => {
      const accounts: ScrapedAccount[] = [
        {
          accountNumber: 'ACC1',
          txns: [
            {
              type: 'normal',
              identifier: 'txn1',
              date: '2024-01-15',
              processedDate: '2024-01-15',
              originalAmount: -100,
              originalCurrency: 'ILS',
              chargedAmount: -100,
              description: 'Transaction 1',
              status: 'completed',
            },
          ],
        },
        {
          accountNumber: 'ACC2',
          txns: [
            {
              type: 'normal',
              identifier: 'txn2',
              date: '2024-01-16',
              processedDate: '2024-01-16',
              originalAmount: -200,
              originalCurrency: 'ILS',
              chargedAmount: -200,
              description: 'Transaction 2',
              status: 'completed',
            },
          ],
        },
      ];

      const result = mapAccountTransactions(accounts);

      expect(result).toHaveLength(2);
      expect(result[0]!.externalAccountId).toBe('ACC1');
      expect(result[1]!.externalAccountId).toBe('ACC2');
    });

    it('should skip pending transactions', () => {
      const accounts: ScrapedAccount[] = [
        {
          accountNumber: 'ACC1',
          txns: [
            {
              type: 'normal',
              identifier: 'completed1',
              date: '2024-01-15',
              processedDate: '2024-01-15',
              originalAmount: -100,
              originalCurrency: 'ILS',
              chargedAmount: -100,
              description: 'Completed',
              status: 'completed',
            },
            {
              type: 'normal',
              identifier: 'pending1',
              date: '2024-01-16',
              processedDate: '2024-01-16',
              originalAmount: -50,
              originalCurrency: 'ILS',
              chargedAmount: -50,
              description: 'Pending',
              status: 'pending',
            },
          ],
        },
      ];

      const result = mapAccountTransactions(accounts);

      expect(result).toHaveLength(1);
      expect(result[0]!.description).toBe('Completed');
    });

    it('should return empty array for empty accounts', () => {
      const result = mapAccountTransactions([]);
      expect(result).toHaveLength(0);
    });
  });
});


