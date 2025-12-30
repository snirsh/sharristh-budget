import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import { OneZeroAdapter } from '../../adapters/onezero';

// Mock the israeli-bank-scrapers library
vi.mock('israeli-bank-scrapers', () => ({
  createScraper: vi.fn(),
  CompanyTypes: {
    isracard: 'isracard',
    oneZero: 'oneZero',
  },
}));

// Mock global fetch for 2FA API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OneZeroAdapter', () => {
  let adapter: OneZeroAdapter;
  let mockScraper: { scrape: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    adapter = new OneZeroAdapter();
    mockScraper = {
      scrape: vi.fn(),
    };
    vi.mocked(createScraper).mockReturnValue(mockScraper as any);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('adapter properties', () => {
    it('should have correct provider identifier', () => {
      expect(adapter.provider).toBe('onezero');
    });

    it('should have correct display name', () => {
      expect(adapter.displayName).toBe('OneZero Bank');
    });

    it('should require 2FA', () => {
      expect(adapter.requiresTwoFactor).toBe(true);
    });
  });

  describe('scrape', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'testpass',
      phoneNumber: '+972501234567',
    };
    const startDate = new Date('2024-01-01');
    const longTermToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token';

    it('should create scraper with correct options', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [],
      });

      await adapter.scrape(startDate, credentials, longTermToken);

      expect(createScraper).toHaveBeenCalledWith({
        companyId: CompanyTypes.oneZero,
        startDate,
        combineInstallments: false,
        showBrowser: false,
      });
    });

    it('should pass email (not username) to scraper', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [],
      });

      await adapter.scrape(startDate, credentials, longTermToken);

      expect(mockScraper.scrape).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'testpass',
        })
      );
    });

    it('should pass otpLongTermToken (not longTermTwoFactorAuthToken) to scraper', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [],
      });

      await adapter.scrape(startDate, credentials, longTermToken);

      expect(mockScraper.scrape).toHaveBeenCalledWith(
        expect.objectContaining({
          otpLongTermToken: longTermToken,
        })
      );
    });

    it('should not include otpLongTermToken when not provided', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [],
      });

      await adapter.scrape(startDate, credentials, undefined);

      expect(mockScraper.scrape).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'testpass',
      });
    });

    it('should return mapped accounts on success', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: true,
        accounts: [
          {
            accountNumber: 'ONE-12345',
            balance: 5000,
            txns: [
              {
                type: 'normal',
                identifier: 'txn1',
                date: '2024-01-15',
                processedDate: '2024-01-16',
                originalAmount: -200,
                originalCurrency: 'ILS',
                chargedAmount: -200,
                description: 'Test Transaction',
                status: 'completed',
              },
            ],
          },
        ],
      });

      const result = await adapter.scrape(startDate, credentials, longTermToken);

      expect(result.success).toBe(true);
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts![0]!.accountNumber).toBe('ONE-12345');
    });

    it('should return error on scrape failure', async () => {
      mockScraper.scrape.mockResolvedValue({
        success: false,
        errorType: 'INVALID_PASSWORD',
        errorMessage: 'Invalid credentials',
      });

      const result = await adapter.scrape(startDate, credentials, longTermToken);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('INVALID_PASSWORD');
    });
  });

  describe('initTwoFactor', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'testpass',
      phoneNumber: '0501234567',
    };

    it('should convert local phone number to international format', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { deviceToken: 'dev-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { otpContext: 'otp-ctx' } }),
        });

      await adapter.initTwoFactor(credentials);

      // Check that the second call (otp/prepare) used international format
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondCallBody = JSON.parse(mockFetch.mock.calls[1]![1]!.body);
      expect(secondCallBody.factorValue).toBe('+972501234567');
    });

    it('should keep phone number if already international', async () => {
      const credsWithIntlPhone = {
        ...credentials,
        phoneNumber: '+972501234567',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { deviceToken: 'dev-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { otpContext: 'otp-ctx' } }),
        });

      await adapter.initTwoFactor(credsWithIntlPhone);

      const secondCallBody = JSON.parse(mockFetch.mock.calls[1]![1]!.body);
      expect(secondCallBody.factorValue).toBe('+972501234567');
    });

    it('should return sessionId on success', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { deviceToken: 'dev-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { otpContext: 'otp-ctx' } }),
        });

      const result = await adapter.initTwoFactor(credentials);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^onezero_\d+_\w+$/);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await adapter.initTwoFactor(credentials);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('500');
    });

    it('should call correct API endpoints', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { deviceToken: 'dev-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { otpContext: 'otp-ctx' } }),
        });

      await adapter.initTwoFactor(credentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://identity.tfd-bank.com/v1/devices/token',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://identity.tfd-bank.com/v1/otp/prepare',
        expect.any(Object)
      );
    });
  });

  describe('completeTwoFactor', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'testpass',
      phoneNumber: '+972501234567',
    };
    const otpCode = '123456';

    it('should return error if sessionId is missing', async () => {
      const result = await adapter.completeTwoFactor(credentials, otpCode, undefined);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Session expired');
    });

    it('should return error if sessionId is invalid', async () => {
      const result = await adapter.completeTwoFactor(credentials, otpCode, 'invalid-session');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Session expired');
    });

    it('should return longTermToken on successful OTP verification', async () => {
      // First, init 2FA to get a valid sessionId
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { deviceToken: 'dev-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { otpContext: 'otp-ctx' } }),
        });

      const initResult = await adapter.initTwoFactor(credentials);
      expect(initResult.sessionId).toBeDefined();

      // Now complete 2FA
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ resultData: { otpToken: 'long-term-token-123' } }),
      });

      const completeResult = await adapter.completeTwoFactor(
        credentials,
        otpCode,
        initResult.sessionId
      );

      expect(completeResult.success).toBe(true);
      expect(completeResult.longTermToken).toBe('long-term-token-123');
    });

    it('should call correct verify endpoint', async () => {
      // Setup init first
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { deviceToken: 'dev-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { otpContext: 'test-otp-context' } }),
        });

      const initResult = await adapter.initTwoFactor(credentials);
      mockFetch.mockClear();

      // Complete 2FA
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ resultData: { otpToken: 'token' } }),
      });

      await adapter.completeTwoFactor(credentials, otpCode, initResult.sessionId);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://identity.tfd-bank.com/v1/otp/verify',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-otp-context'),
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0]![1]!.body);
      expect(callBody.otpCode).toBe(otpCode);
      expect(callBody.otpContext).toBe('test-otp-context');
    });

    it('should return error when OTP token is missing in response', async () => {
      // Setup init first
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { deviceToken: 'dev-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { otpContext: 'otp-ctx' } }),
        });

      const initResult = await adapter.initTwoFactor(credentials);

      // Complete with empty response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ resultData: {} }),
      });

      const result = await adapter.completeTwoFactor(credentials, otpCode, initResult.sessionId);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Failed to verify OTP');
    });
  });

  describe('session cleanup', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'testpass',
      phoneNumber: '+972501234567',
    };

    it('should remove session after successful completion', async () => {
      // Setup init
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { deviceToken: 'dev-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resultData: { otpContext: 'otp-ctx' } }),
        });

      const initResult = await adapter.initTwoFactor(credentials);
      const sessionId = initResult.sessionId!;

      // Complete 2FA
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ resultData: { otpToken: 'token' } }),
      });

      await adapter.completeTwoFactor(credentials, '123456', sessionId);

      // Try to use same session again - should fail
      const result = await adapter.completeTwoFactor(credentials, '123456', sessionId);
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Session expired');
    });
  });
});



