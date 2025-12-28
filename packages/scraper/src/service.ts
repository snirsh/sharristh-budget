import { getAdapter } from './adapters';
import { encryptCredentials, decryptCredentials, encryptToken, decryptToken } from './encryption';
import { mapAccountTransactions } from './utils/transaction-mapper';
import { filterNewTransactions } from './utils/deduplication';
import type { 
  BankProvider, 
  ProviderCredentials, 
  MappedTransaction,
  SyncResult,
  TwoFactorInitResult,
  TwoFactorCompleteResult,
} from './types';

export interface BankConnectionData {
  id: string;
  provider: BankProvider;
  encryptedCreds: string;
  longTermToken: string | null;
}

export interface ScraperServiceConfig {
  /** Default number of days to look back for transactions */
  defaultLookbackDays?: number;
}

/**
 * Main service for bank scraping operations
 */
export class ScraperService {
  private config: Required<ScraperServiceConfig>;

  constructor(config: ScraperServiceConfig = {}) {
    this.config = {
      defaultLookbackDays: config.defaultLookbackDays ?? 90,
    };
  }

  /**
   * Encrypt credentials for storage
   */
  encryptCredentials(credentials: ProviderCredentials): string {
    return encryptCredentials(credentials);
  }

  /**
   * Decrypt credentials from storage
   */
  decryptCredentials<T extends ProviderCredentials>(encrypted: string): T {
    return decryptCredentials<T>(encrypted);
  }

  /**
   * Encrypt a 2FA token for storage
   */
  encryptToken(token: string): string {
    return encryptToken(token);
  }

  /**
   * Decrypt a 2FA token from storage
   */
  decryptToken(encrypted: string): string {
    return decryptToken(encrypted);
  }

  /**
   * Sync transactions from a bank connection
   * @param connection - The bank connection data
   * @param existingExternalIds - Set of external IDs already in the database
   * @param startDate - Optional start date (defaults to lookback days)
   */
  async syncConnection(
    connection: BankConnectionData,
    existingExternalIds: Set<string>,
    startDate?: Date
  ): Promise<{ result: SyncResult; transactions: MappedTransaction[] }> {
    console.log(`[ScraperService] Starting sync for connection ${connection.id} (${connection.provider})`);
    
    const adapter = getAdapter(connection.provider);
    const credentials = this.decryptCredentials(connection.encryptedCreds);
    
    const effectiveStartDate = startDate ?? this.getDefaultStartDate();
    console.log(`[ScraperService] Effective start date: ${effectiveStartDate.toISOString()}`);
    
    // Decrypt long-term token if present
    const longTermToken = connection.longTermToken 
      ? this.decryptToken(connection.longTermToken) 
      : undefined;
    
    console.log(`[ScraperService] Has long-term token: ${!!longTermToken}`);

    // Perform the scrape
    console.log('[ScraperService] Calling adapter.scrape()...');
    const scrapeResult = await adapter.scrape(effectiveStartDate, credentials, longTermToken);

    console.log(`[ScraperService] Scrape result: success=${scrapeResult.success}, accounts=${scrapeResult.accounts?.length || 0}`);
    
    if (!scrapeResult.success || !scrapeResult.accounts) {
      console.error(`[ScraperService] Scrape failed: ${scrapeResult.errorMessage}`);
      return {
        result: {
          success: false,
          transactionsFound: 0,
          transactionsNew: 0,
          errorMessage: scrapeResult.errorMessage || 'Unknown scrape error',
        },
        transactions: [],
      };
    }

    // Map transactions to our format
    const allTransactions = mapAccountTransactions(scrapeResult.accounts);
    
    // Filter out existing transactions
    const newTransactions = filterNewTransactions(allTransactions, existingExternalIds);

    return {
      result: {
        success: true,
        transactionsFound: allTransactions.length,
        transactionsNew: newTransactions.length,
      },
      transactions: newTransactions,
    };
  }

  /**
   * Initialize 2FA for a provider
   */
  async initTwoFactor(
    provider: BankProvider,
    credentials: ProviderCredentials
  ): Promise<TwoFactorInitResult> {
    const adapter = getAdapter(provider);
    
    if (!adapter.requiresTwoFactor || !adapter.initTwoFactor) {
      return {
        success: false,
        errorMessage: `Provider ${provider} does not require 2FA`,
      };
    }

    return adapter.initTwoFactor(credentials);
  }

  /**
   * Complete 2FA and get long-term token
   * @param sessionId - Optional session ID from initTwoFactor (for stateful 2FA like OneZero)
   */
  async completeTwoFactor(
    provider: BankProvider,
    credentials: ProviderCredentials,
    otpCode: string,
    sessionId?: string
  ): Promise<TwoFactorCompleteResult> {
    const adapter = getAdapter(provider);
    
    if (!adapter.requiresTwoFactor || !adapter.completeTwoFactor) {
      return {
        success: false,
        errorMessage: `Provider ${provider} does not require 2FA`,
      };
    }

    return adapter.completeTwoFactor(credentials, otpCode, sessionId);
  }

  /**
   * Check if a provider requires 2FA
   */
  requiresTwoFactor(provider: BankProvider): boolean {
    const adapter = getAdapter(provider);
    return adapter.requiresTwoFactor;
  }

  /**
   * Get the display name for a provider
   */
  getProviderDisplayName(provider: BankProvider): string {
    const adapter = getAdapter(provider);
    return adapter.displayName;
  }

  /**
   * Get the default start date based on lookback days
   */
  private getDefaultStartDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() - this.config.defaultLookbackDays);
    return date;
  }
}

// Export a default instance
export const scraperService = new ScraperService();

