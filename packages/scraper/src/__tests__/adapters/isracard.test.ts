import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import { IsracardAdapter } from '../../adapters/isracard';

// Mock the israeli-bank-scrapers library
vi.mock('israeli-bank-scrapers', () => ({
  createScraper: vi.fn(),
  CompanyTypes: {
    isracard: 'isracard',
    oneZero: 'oneZero',
  },
}));

describe('IsracardAdapter', () => {
  let adapter: IsracardAdapter;
  let mockScraper: { scrape: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    adapter = new IsracardAdapter();
    mockScraper = {
      scrape: vi.fn(),
    };
    vi.mocked(createScraper).mockReturnValue(mockScraper as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('adapter properties', () => {
    it('should have correct provider identifier', () => {
      expect(adapter.provider).toBe('isracard');
    });

    it('should have correct display name', () => {
      expect(adapter.displayName).toBe('Isracard');
    });

    it('should not require 2FA', () => {
      expect(adapter.requiresTwoFactor).toBe(false);
    });
  });

  describe('scrape', () => {
    const credentials = {
      id: '123456789',
      card6Digits: '123456',
      password: 'testpass',
    };
    const startDate = new Date('2024-01-01');

    it('should create scraper with correct options', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [],
      });

      await adapter.scrape(startDate, credentials);

      expect(createScraper).toHaveBeenCalledWith({
        companyId: CompanyTypes.isracard,
        startDate,
        combineInstallments: false,
        showBrowser: false,
      });
    });

    it('should pass correct credentials to scraper', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [],
      });

      await adapter.scrape(startDate, credentials);

      expect(mockScraper.scrape).toHaveBeenCalledWith({
        id: '123456789',
        card6Digits: '123456',
        password: 'testpass',
      });
    });

    it('should return mapped accounts on success', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [
          {
            accountNumber: 'CARD-123456',
            balance: 1000,
            txns: [
              {
                type: 'normal',
                identifier: 'txn1',
                date: '2024-01-15',
                processedDate: '2024-01-16',
                originalAmount: -100,
                originalCurrency: 'ILS',
                chargedAmount: -100,
                chargedCurrency: 'ILS',
                description: 'Test Transaction',
                status: 'completed',
              },
            ],
          },
        ],
      });

      const result = await adapter.scrape(startDate, credentials);

      expect(result.success).toBe(true);
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts![0]!.accountNumber).toBe('CARD-123456');
      expect(result.accounts![0]!.txns).toHaveLength(1);
      expect(result.accounts![0]!.txns[0]!.description).toBe('Test Transaction');
    });

    it('should return error on scrape failure', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: false,
        errorType: 'INVALID_PASSWORD',
        errorMessage: 'Invalid credentials',
      });

      const result = await adapter.scrape(startDate, credentials);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('INVALID_PASSWORD');
      expect(result.errorMessage).toBe('Invalid credentials');
    });

    it('should handle scraper exceptions', async () => {
      mockScraper.scrape.mockRejectedValue(new Error('Network error'));

      const result = await adapter.scrape(startDate, credentials);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('UNKNOWN');
      expect(result.errorMessage).toBe('Network error');
    });

    it('should map installment transactions correctly', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [
          {
            accountNumber: 'CARD-123456',
            txns: [
              {
                type: 'installments',
                identifier: 'inst1',
                date: '2024-01-15',
                processedDate: '2024-01-16',
                originalAmount: -300,
                originalCurrency: 'ILS',
                chargedAmount: -100,
                description: 'Big Purchase',
                installments: { number: 1, total: 3 },
                status: 'completed',
              },
            ],
          },
        ],
      });

      const result = await adapter.scrape(startDate, credentials);

      expect(result.accounts![0]!.txns[0]!.type).toBe('installments');
      expect(result.accounts![0]!.txns[0]!.installments).toEqual({ number: 1, total: 3 });
    });

    it('should map pending transactions correctly', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [
          {
            accountNumber: 'CARD-123456',
            txns: [
              {
                type: 'normal',
                date: '2024-01-15',
                processedDate: '2024-01-16',
                originalAmount: -50,
                originalCurrency: 'ILS',
                chargedAmount: -50,
                description: 'Pending Transaction',
                status: 'pending',
              },
            ],
          },
        ],
      });

      const result = await adapter.scrape(startDate, credentials);

      expect(result.accounts![0]!.txns[0]!.status).toBe('pending');
    });
  });
});



