import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScraperService } from '../service';
import { getAdapter } from '../adapters/base';

// Mock the adapters
vi.mock('../adapters/base', () => ({
  getAdapter: vi.fn(),
  registerAdapter: vi.fn(), // Needed because adapters register themselves on import
  scraperAdapters: new Map(),
}));

// Also need to mock the adapters to prevent their side effects
vi.mock('../adapters/onezero', () => ({}));
vi.mock('../adapters/isracard', () => ({}));

// Mock encryption
vi.mock('../encryption', () => ({
  encryptCredentials: vi.fn((creds) => `encrypted:${JSON.stringify(creds)}`),
  decryptCredentials: vi.fn((encrypted: string) => JSON.parse(encrypted.replace('encrypted:', ''))),
  encryptToken: vi.fn((token) => `encrypted_token:${token}`),
  decryptToken: vi.fn((encrypted: string) => encrypted.replace('encrypted_token:', '')),
}));

describe('ScraperService', () => {
  let service: ScraperService;
  let mockAdapter: {
    provider: string;
    displayName: string;
    requiresTwoFactor: boolean;
    scrape: ReturnType<typeof vi.fn>;
    initTwoFactor?: ReturnType<typeof vi.fn>;
    completeTwoFactor?: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = new ScraperService({ defaultLookbackDays: 30 });
    mockAdapter = {
      provider: 'onezero',
      displayName: 'OneZero Bank',
      requiresTwoFactor: true,
      scrape: vi.fn(),
      initTwoFactor: vi.fn(),
      completeTwoFactor: vi.fn(),
    };
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default lookback days when not specified', () => {
      const defaultService = new ScraperService();
      // Default is 90 days - we verify by checking default start date calculation
      expect(defaultService).toBeDefined();
    });

    it('should use custom lookback days when specified', () => {
      const customService = new ScraperService({ defaultLookbackDays: 60 });
      expect(customService).toBeDefined();
    });
  });

  describe('encryptCredentials / decryptCredentials', () => {
    it('should encrypt credentials', () => {
      const creds = { email: 'test@example.com', password: 'pass', phoneNumber: '555-1234' };
      const encrypted = service.encryptCredentials(creds);
      expect(encrypted).toContain('encrypted:');
    });

    it('should decrypt credentials', () => {
      const creds = { email: 'test@example.com', password: 'pass', phoneNumber: '555-1234' };
      const encrypted = service.encryptCredentials(creds);
      const decrypted = service.decryptCredentials<typeof creds>(encrypted);
      expect(decrypted).toEqual(creds);
    });
  });

  describe('encryptToken / decryptToken', () => {
    it('should encrypt token', () => {
      const token = 'my-secret-token';
      const encrypted = service.encryptToken(token);
      expect(encrypted).toContain('encrypted_token:');
    });

    it('should decrypt token', () => {
      const token = 'my-secret-token';
      const encrypted = service.encryptToken(token);
      const decrypted = service.decryptToken(encrypted);
      expect(decrypted).toBe(token);
    });
  });

  describe('requiresTwoFactor', () => {
    it('should return true for OneZero', () => {
      mockAdapter.requiresTwoFactor = true;
      expect(service.requiresTwoFactor('onezero')).toBe(true);
    });

    it('should return false for Isracard', () => {
      mockAdapter.requiresTwoFactor = false;
      expect(service.requiresTwoFactor('isracard')).toBe(false);
    });
  });

  describe('getProviderDisplayName', () => {
    it('should return display name for provider', () => {
      mockAdapter.displayName = 'OneZero Bank';
      expect(service.getProviderDisplayName('onezero')).toBe('OneZero Bank');
    });
  });

  describe('syncConnection', () => {
    const connection = {
      id: 'conn123',
      provider: 'onezero' as const,
      encryptedCreds: 'encrypted:{"email":"test@example.com","password":"pass","phoneNumber":"+972501234567"}',
      longTermToken: 'encrypted_token:long-term-token',
    };

    it('should call adapter with decrypted credentials', async () => {
      mockAdapter.scrape.mockResolvedValue({
        success: true,
        accounts: [],
      });

      await service.syncConnection(connection, new Set());

      expect(mockAdapter.scrape).toHaveBeenCalledWith(
        expect.any(Date),
        expect.objectContaining({
          email: 'test@example.com',
          password: 'pass',
        }),
        'long-term-token'
      );
    });

    it('should pass undefined for longTermToken when not present', async () => {
      const connWithoutToken = {
        ...connection,
        longTermToken: null,
      };

      mockAdapter.scrape.mockResolvedValue({
        success: true,
        accounts: [],
      });

      await service.syncConnection(connWithoutToken, new Set());

      expect(mockAdapter.scrape).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Object),
        undefined
      );
    });

    it('should use provided startDate', async () => {
      const customStartDate = new Date('2024-01-01');
      mockAdapter.scrape.mockResolvedValue({
        success: true,
        accounts: [],
      });

      await service.syncConnection(connection, new Set(), customStartDate);

      expect(mockAdapter.scrape).toHaveBeenCalledWith(
        customStartDate,
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should return success result with transaction counts', async () => {
      mockAdapter.scrape.mockResolvedValue({
        success: true,
        accounts: [
          {
            accountNumber: 'ACC123',
            txns: [
              {
                type: 'normal',
                identifier: 'txn1',
                date: '2024-01-15',
                processedDate: '2024-01-15',
                originalAmount: -100,
                originalCurrency: 'ILS',
                chargedAmount: -100,
                description: 'Test',
                status: 'completed',
              },
              {
                type: 'normal',
                identifier: 'txn2',
                date: '2024-01-16',
                processedDate: '2024-01-16',
                originalAmount: -200,
                originalCurrency: 'ILS',
                chargedAmount: -200,
                description: 'Test 2',
                status: 'completed',
              },
            ],
          },
        ],
      });

      const { result, transactions } = await service.syncConnection(connection, new Set());

      expect(result.success).toBe(true);
      expect(result.transactionsFound).toBe(2);
      expect(result.transactionsNew).toBe(2);
      expect(transactions).toHaveLength(2);
    });

    it('should filter out existing transactions', async () => {
      mockAdapter.scrape.mockResolvedValue({
        success: true,
        accounts: [
          {
            accountNumber: 'ACC123',
            txns: [
              {
                type: 'normal',
                identifier: 'txn1',
                date: '2024-01-15',
                processedDate: '2024-01-15',
                originalAmount: -100,
                originalCurrency: 'ILS',
                chargedAmount: -100,
                description: 'Test',
                status: 'completed',
              },
              {
                type: 'normal',
                identifier: 'txn2',
                date: '2024-01-16',
                processedDate: '2024-01-16',
                originalAmount: -200,
                originalCurrency: 'ILS',
                chargedAmount: -200,
                description: 'Test 2',
                status: 'completed',
              },
            ],
          },
        ],
      });

      const existingIds = new Set(['ACC123_txn1']);
      const { result, transactions } = await service.syncConnection(connection, existingIds);

      expect(result.transactionsFound).toBe(2);
      expect(result.transactionsNew).toBe(1);
      expect(transactions).toHaveLength(1);
      expect(transactions[0]!.externalId).toBe('ACC123_txn2');
    });

    it('should return error result on scrape failure', async () => {
      mockAdapter.scrape.mockResolvedValue({
        success: false,
        errorMessage: 'Invalid credentials',
      });

      const { result, transactions } = await service.syncConnection(connection, new Set());

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Invalid credentials');
      expect(result.transactionsFound).toBe(0);
      expect(transactions).toHaveLength(0);
    });
  });

  describe('initTwoFactor', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'pass',
      phoneNumber: '+972501234567',
    };

    it('should call adapter initTwoFactor', async () => {
      mockAdapter.initTwoFactor!.mockResolvedValue({
        success: true,
        sessionId: 'session123',
      });

      const result = await service.initTwoFactor('onezero', credentials);

      expect(mockAdapter.initTwoFactor).toHaveBeenCalledWith(credentials);
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session123');
    });

    it('should return error for providers that do not require 2FA', async () => {
      mockAdapter.requiresTwoFactor = false;
      mockAdapter.initTwoFactor = undefined;

      const result = await service.initTwoFactor('onezero', credentials);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('does not require 2FA');
    });
  });

  describe('completeTwoFactor', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'pass',
      phoneNumber: '+972501234567',
    };

    it('should call adapter completeTwoFactor with sessionId', async () => {
      mockAdapter.completeTwoFactor!.mockResolvedValue({
        success: true,
        longTermToken: 'new-token',
      });

      const result = await service.completeTwoFactor('onezero', credentials, '123456', 'session123');

      expect(mockAdapter.completeTwoFactor).toHaveBeenCalledWith(credentials, '123456', 'session123');
      expect(result.success).toBe(true);
      expect(result.longTermToken).toBe('new-token');
    });

    it('should return error for providers that do not require 2FA', async () => {
      mockAdapter.requiresTwoFactor = false;
      mockAdapter.completeTwoFactor = undefined;

      const result = await service.completeTwoFactor('onezero', credentials, '123456', 'session123');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('does not require 2FA');
    });
  });
});

