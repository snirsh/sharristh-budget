import type { 
  BankProvider, 
  ScrapeResult, 
  TwoFactorInitResult, 
  TwoFactorCompleteResult 
} from '../types';

/**
 * Base interface for all bank/credit card scrapers
 */
export interface ScraperAdapter {
  /** Provider identifier */
  readonly provider: BankProvider;
  
  /** Human-readable provider name */
  readonly displayName: string;
  
  /** Whether this provider requires 2FA setup */
  readonly requiresTwoFactor: boolean;

  /**
   * Scrape transactions from the provider
   * @param startDate - Start date for transaction fetch
   * @param credentials - Provider-specific credentials (already decrypted)
   * @param longTermToken - Optional long-term 2FA token
   */
  scrape(
    startDate: Date,
    credentials: object,
    longTermToken?: string
  ): Promise<ScrapeResult>;

  /**
   * Initialize 2FA flow (send OTP to user's phone)
   * Only applicable for providers that require 2FA
   */
  initTwoFactor?(credentials: object): Promise<TwoFactorInitResult>;

  /**
   * Complete 2FA flow and get long-term token
   * Only applicable for providers that require 2FA
   * @param credentials - Provider-specific credentials
   * @param otpCode - OTP code received by user
   * @param sessionId - Optional session ID from initTwoFactor (for stateful 2FA)
   */
  completeTwoFactor?(
    credentials: object,
    otpCode: string,
    sessionId?: string
  ): Promise<TwoFactorCompleteResult>;
}

/**
 * Registry of available scraper adapters
 */
export const scraperAdapters: Map<BankProvider, ScraperAdapter> = new Map();

/**
 * Register a scraper adapter
 */
export function registerAdapter(adapter: ScraperAdapter): void {
  scraperAdapters.set(adapter.provider, adapter);
}

/**
 * Get a scraper adapter by provider
 */
export function getAdapter(provider: BankProvider): ScraperAdapter {
  const adapter = scraperAdapters.get(provider);
  if (!adapter) {
    throw new Error(`No adapter registered for provider: ${provider}`);
  }
  return adapter;
}

