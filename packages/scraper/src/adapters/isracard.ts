import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import type { ScraperAdapter } from './base';
import { registerAdapter } from './base';
import type {
  IsraCardCredentials,
  ScrapeResult,
  ScrapedAccount,
} from '../types';
import { getScraperBrowserOptions } from '../chromium-config';

/**
 * Isracard Credit Card Adapter
 * Uses ID + last 6 digits of card + password authentication
 */
class IsracardAdapter implements ScraperAdapter {
  readonly provider = 'isracard' as const;
  readonly displayName = 'Isracard';
  readonly requiresTwoFactor = false;

  async scrape(
    startDate: Date,
    credentials: object,
  ): Promise<ScrapeResult> {
    const creds = credentials as IsraCardCredentials;

    console.log('[Isracard] Starting scrape with startDate:', startDate.toISOString());
    console.log('[Isracard] ID:', creds.id?.substring(0, 3) + '***');
    console.log('[Isracard] Card digits:', creds.card6Digits);

    try {
      // Get browser options optimized for Vercel/serverless environments
      const browserOptions = await getScraperBrowserOptions();
      
      console.log('[Isracard] Browser options:', {
        hasExecutablePath: !!browserOptions.executablePath,
        argsCount: browserOptions.args?.length || 0,
        showBrowser: browserOptions.showBrowser,
      });

      // Create scraper with browser options
      // The library accepts executablePath and args directly in the options
      const scraper = createScraper({
        companyId: CompanyTypes.isracard,
        startDate,
        combineInstallments: false,
        showBrowser: browserOptions.showBrowser ?? false,
        executablePath: browserOptions.executablePath,
        args: browserOptions.args,
      });

      console.log('[Isracard] Calling scraper.scrape()...');
      const result = await scraper.scrape({
        id: creds.id,
        card6Digits: creds.card6Digits,
        password: creds.password,
      });

      console.log('[Isracard] Scrape result success:', result.success);
      if (!result.success) {
        console.error('[Isracard] Scrape failed:', result.errorType, result.errorMessage);
        return {
          success: false,
          errorType: result.errorType,
          errorMessage: result.errorMessage || `Scrape failed: ${result.errorType}`,
        };
      }

      console.log('[Isracard] Scrape successful, accounts:', result.accounts?.length || 0);

      // Map the accounts to our format
      const accounts: ScrapedAccount[] = (result.accounts || []).map((acc) => ({
        accountNumber: acc.accountNumber,
        balance: acc.balance,
        txns: acc.txns.map((txn) => ({
          type: txn.type === 'installments' ? 'installments' : 'normal',
          identifier: txn.identifier,
          date: txn.date,
          processedDate: txn.processedDate,
          originalAmount: txn.originalAmount,
          originalCurrency: txn.originalCurrency,
          chargedAmount: txn.chargedAmount,
          chargedCurrency: txn.chargedCurrency,
          description: txn.description,
          memo: txn.memo,
          category: (txn as unknown as { category?: string }).category, // Extract category/sector from Isracard
          installments: txn.installments,
          status: txn.status === 'pending' ? 'pending' : 'completed',
        })),
      }));

      return {
        success: true,
        accounts,
      };
    } catch (error) {
      console.error('[Isracard] Scrape exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      if (errorStack) {
        console.error('[Isracard] Error stack:', errorStack);
      }

      return {
        success: false,
        errorType: 'EXCEPTION',
        errorMessage: `Isracard scrape failed: ${errorMessage}`,
      };
    }
  }
}

// Register the adapter
registerAdapter(new IsracardAdapter());

export { IsracardAdapter };



