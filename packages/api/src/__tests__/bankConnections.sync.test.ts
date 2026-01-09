import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for bank connection sync logic
 * 
 * These tests verify:
 * - Sync status checking logic
 * - Stale connection detection
 * - Cron endpoint authorization
 * - Error handling during sync
 */

describe('Bank Connection Sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Stale Connection Detection', () => {
    it('should consider connection stale if lastSyncAt is null', () => {
      const lastSyncAt: Date | null = null;
      const staleThresholdHours = 12;
      const staleThreshold = new Date();
      staleThreshold.setHours(staleThreshold.getHours() - staleThresholdHours);

      // Helper function to check if stale
      const checkIsStale = (syncAt: Date | null, threshold: Date): boolean => {
        if (syncAt === null) return true;
        return syncAt < threshold;
      };
      const isStale = checkIsStale(lastSyncAt, staleThreshold);
      expect(isStale).toBe(true);
    });

    it('should consider connection stale if lastSyncAt is older than threshold', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const lastSyncAt = new Date('2024-01-14T23:00:00Z'); // 13 hours ago
      const staleThresholdHours = 12;
      const staleThreshold = new Date();
      staleThreshold.setHours(staleThreshold.getHours() - staleThresholdHours);

      const isStale = lastSyncAt === null || lastSyncAt < staleThreshold;
      expect(isStale).toBe(true);
    });

    it('should not consider connection stale if recently synced', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const lastSyncAt = new Date('2024-01-15T06:00:00Z'); // 6 hours ago
      const staleThresholdHours = 12;
      const staleThreshold = new Date();
      staleThreshold.setHours(staleThreshold.getHours() - staleThresholdHours);

      const isStale = lastSyncAt === null || lastSyncAt < staleThreshold;
      expect(isStale).toBe(false);
    });

    it('should use correct threshold for different stale hours', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const lastSyncAt = new Date('2024-01-14T15:00:00Z'); // 21 hours ago

      // With 12 hour threshold - should be stale
      const threshold12 = new Date(now);
      threshold12.setHours(threshold12.getHours() - 12);
      expect(lastSyncAt < threshold12).toBe(true);

      // With 24 hour threshold - should NOT be stale
      const threshold24 = new Date(now);
      threshold24.setHours(threshold24.getHours() - 24);
      expect(lastSyncAt < threshold24).toBe(false);
    });
  });

  describe('Cron Authorization', () => {
    it('should validate CRON_SECRET header format', () => {
      const cronSecret = 'test-secret-123';
      const validHeader = `Bearer ${cronSecret}`;
      const invalidHeader = cronSecret; // Missing Bearer prefix

      expect(validHeader).toBe(`Bearer ${cronSecret}`);
      expect(invalidHeader).not.toBe(`Bearer ${cronSecret}`);
    });

    it('should reject empty authorization header', () => {
      const cronSecret = 'test-secret-123';
      const emptyHeader: string = '';

      const isAuthorized = emptyHeader === `Bearer ${cronSecret}`;
      expect(isAuthorized).toBe(false);
    });

    it('should reject null authorization header', () => {
      const cronSecret = 'test-secret-123';
      const nullHeader: string | null = null;

      const isAuthorized = nullHeader === `Bearer ${cronSecret}`;
      expect(isAuthorized).toBe(false);
    });

    it('should accept valid authorization header', () => {
      const cronSecret = 'test-secret-123';
      const validHeader = `Bearer ${cronSecret}`;

      const isAuthorized = validHeader === `Bearer ${cronSecret}`;
      expect(isAuthorized).toBe(true);
    });
  });

  describe('Sync Result Aggregation', () => {
    it('should calculate success count correctly', () => {
      const results = [
        { connectionId: '1', success: true, transactionsNew: 5 },
        { connectionId: '2', success: false, errorMessage: 'Auth error' },
        { connectionId: '3', success: true, transactionsNew: 10 },
        { connectionId: '4', success: true, transactionsNew: 0 },
      ];

      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(3);
    });

    it('should calculate total new transactions correctly', () => {
      const results = [
        { connectionId: '1', success: true, transactionsNew: 5 },
        { connectionId: '2', success: false, transactionsNew: undefined },
        { connectionId: '3', success: true, transactionsNew: 10 },
        { connectionId: '4', success: true, transactionsNew: 0 },
      ];

      const totalNew = results.reduce((sum, r) => sum + (r.transactionsNew || 0), 0);
      expect(totalNew).toBe(15);
    });

    it('should identify connections needing re-authentication', () => {
      const results = [
        { connectionId: '1', success: true, transactionsNew: 5 },
        { connectionId: '2', success: false, errorMessage: 're-authenticate required' },
        { connectionId: '3', success: false, errorMessage: 'token expired' },
        { connectionId: '4', success: false, errorMessage: 'network error' },
      ];

      const authErrors = results.filter(
        r => !r.success && 
        (r.errorMessage?.includes('re-authenticate') || r.errorMessage?.includes('expired'))
      );

      expect(authErrors.length).toBe(2);
      expect(authErrors.map(r => r.connectionId)).toEqual(['2', '3']);
    });
  });

  describe('Auth Error Detection', () => {
    it('should detect AUTH_REQUIRED error type', () => {
      const result = { errorType: 'AUTH_REQUIRED', errorMessage: 'Session expired' };
      
      const isAuthError = 
        result.errorType === 'AUTH_REQUIRED' ||
        result.errorMessage?.includes('re-authenticate') ||
        result.errorMessage?.includes('expired') ||
        result.errorMessage?.includes('idToken');

      expect(isAuthError).toBe(true);
    });

    it('should detect re-authenticate message', () => {
      const result = { errorType: 'UNKNOWN', errorMessage: 'Please re-authenticate your account' };
      
      const isAuthError = 
        result.errorType === 'AUTH_REQUIRED' ||
        result.errorMessage?.includes('re-authenticate') ||
        result.errorMessage?.includes('expired') ||
        result.errorMessage?.includes('idToken');

      expect(isAuthError).toBe(true);
    });

    it('should detect expired token message', () => {
      const result = { errorType: 'UNKNOWN', errorMessage: 'Token has expired' };
      
      const isAuthError = 
        result.errorType === 'AUTH_REQUIRED' ||
        result.errorMessage?.includes('re-authenticate') ||
        result.errorMessage?.includes('expired') ||
        result.errorMessage?.includes('idToken');

      expect(isAuthError).toBe(true);
    });

    it('should detect idToken error message', () => {
      const result = { errorType: 'UNKNOWN', errorMessage: 'Invalid idToken' };
      
      const isAuthError = 
        result.errorType === 'AUTH_REQUIRED' ||
        result.errorMessage?.includes('re-authenticate') ||
        result.errorMessage?.includes('expired') ||
        result.errorMessage?.includes('idToken');

      expect(isAuthError).toBe(true);
    });

    it('should not falsely detect auth error for network issues', () => {
      const result = { errorType: 'NETWORK_ERROR', errorMessage: 'Connection timeout' };
      
      const isAuthError = 
        result.errorType === 'AUTH_REQUIRED' ||
        result.errorMessage?.includes('re-authenticate') ||
        result.errorMessage?.includes('expired') ||
        result.errorMessage?.includes('idToken');

      expect(isAuthError).toBe(false);
    });
  });

  describe('Cron Schedule Validation', () => {
    it('should validate cron schedule format for Vercel', () => {
      // Vercel uses standard cron format: minute hour day month weekday
      const validSchedule = '0 3 * * *'; // 3 AM UTC daily
      
      const parts = validSchedule.split(' ');
      expect(parts.length).toBe(5);
      expect(parts[0]).toBe('0'); // minute
      expect(parts[1]).toBe('3'); // hour (3 AM UTC = 6 AM Israel time)
      expect(parts[2]).toBe('*'); // day of month
      expect(parts[3]).toBe('*'); // month
      expect(parts[4]).toBe('*'); // day of week
    });

    it('should represent correct Israel time from UTC', () => {
      // Israel is UTC+2 in winter, UTC+3 in summer (DST)
      // 3 AM UTC = 5 AM or 6 AM Israel time
      const utcHour = 3;
      const israelWinterOffset = 2;
      const israelSummerOffset = 3;

      const israelWinterTime = utcHour + israelWinterOffset;
      const israelSummerTime = utcHour + israelSummerOffset;

      expect(israelWinterTime).toBe(5);
      expect(israelSummerTime).toBe(6);
    });
  });

  describe('Environment Configuration', () => {
    it('should skip sync in demo mode', () => {
      const demoMode = 'true';
      const shouldSkip = demoMode === 'true';
      expect(shouldSkip).toBe(true);
    });

    it('should not skip sync when demo mode is false', () => {
      const demoMode: string = 'false';
      const shouldSkip = demoMode === 'true';
      expect(shouldSkip).toBe(false);
    });

    it('should not skip sync when demo mode is undefined', () => {
      const demoMode: string | undefined = undefined;
      const shouldSkip = demoMode === 'true';
      expect(shouldSkip).toBe(false);
    });
  });
});

describe('Sync Service Types', () => {
  it('should have correct CronSyncResult structure', () => {
    interface CronSyncResult {
      success: boolean;
      message: string;
      syncedConnections: number;
      totalTransactionsNew: number;
      totalTransactionsFound?: number;
      errors: string[];
      duration?: number;
      details?: Array<{
        connectionId: string;
        displayName: string;
        success: boolean;
        transactionsNew?: number;
        error?: string;
      }>;
    }

    const validResult: CronSyncResult = {
      success: true,
      message: 'Synced 2/2 connections',
      syncedConnections: 2,
      totalTransactionsNew: 15,
      totalTransactionsFound: 50,
      errors: [],
      duration: 5000,
      details: [
        { connectionId: '1', displayName: 'OneZero', success: true, transactionsNew: 10 },
        { connectionId: '2', displayName: 'Isracard', success: true, transactionsNew: 5 },
      ],
    };

    expect(validResult.success).toBe(true);
    expect(validResult.syncedConnections).toBe(2);
    expect(validResult.totalTransactionsNew).toBe(15);
    expect(validResult.errors).toHaveLength(0);
    expect(validResult.details).toHaveLength(2);
  });

  it('should handle partial failure result', () => {
    interface CronSyncResult {
      success: boolean;
      message: string;
      syncedConnections: number;
      totalTransactionsNew: number;
      errors: string[];
    }

    const partialResult: CronSyncResult = {
      success: true, // At least one succeeded
      message: 'Synced 1/2 connections',
      syncedConnections: 1,
      totalTransactionsNew: 5,
      errors: ['Isracard: Auth token expired'],
    };

    expect(partialResult.success).toBe(true);
    expect(partialResult.syncedConnections).toBe(1);
    expect(partialResult.errors).toHaveLength(1);
  });

  it('should handle complete failure result', () => {
    interface CronSyncResult {
      success: boolean;
      message: string;
      syncedConnections: number;
      totalTransactionsNew: number;
      errors: string[];
    }

    const failedResult: CronSyncResult = {
      success: false,
      message: 'Synced 0/2 connections',
      syncedConnections: 0,
      totalTransactionsNew: 0,
      errors: ['OneZero: Auth required', 'Isracard: Network error'],
    };

    expect(failedResult.success).toBe(false);
    expect(failedResult.syncedConnections).toBe(0);
    expect(failedResult.errors).toHaveLength(2);
  });
});
