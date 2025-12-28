import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import type { ScraperAdapter } from './base';
import { registerAdapter } from './base';
import type { 
  OneZeroCredentials, 
  ScrapeResult, 
  TwoFactorInitResult, 
  TwoFactorCompleteResult,
  ScrapedAccount,
} from '../types';

// Extended scrape options to include long-term 2FA token
// The library expects 'otpLongTermToken' for the long-term token
// and 'email' (not 'username') for the email
interface OneZeroScrapeOptions {
  email: string;
  password: string;
  otpLongTermToken?: string;
}

// Store pending 2FA scraper instances by session ID
// We need to keep the scraper instance alive to maintain the otpContext state
interface Pending2FASession {
  scraper: ReturnType<typeof createScraper>;
  createdAt: Date;
  phoneNumber: string;
}

const pending2FASessions = new Map<string, Pending2FASession>();

// Clean up old sessions (older than 10 minutes)
function cleanupStaleSessions() {
  const now = new Date();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [sessionId, session] of pending2FASessions.entries()) {
    if (now.getTime() - session.createdAt.getTime() > maxAge) {
      console.log(`[OneZero] Cleaning up stale 2FA session: ${sessionId}`);
      pending2FASessions.delete(sessionId);
    }
  }
}

/**
 * OneZero Bank Adapter
 * Supports long-term 2FA tokens for automated syncing
 */
class OneZeroAdapter implements ScraperAdapter {
  readonly provider = 'onezero' as const;
  readonly displayName = 'OneZero Bank';
  readonly requiresTwoFactor = true;

  async scrape(
    startDate: Date,
    credentials: object,
    longTermToken?: string
  ): Promise<ScrapeResult> {
    const creds = credentials as OneZeroCredentials;

    console.log('[OneZero] Starting scrape with startDate:', startDate.toISOString());
    console.log('[OneZero] Has longTermToken:', !!longTermToken);
    console.log('[OneZero] Email:', creds.email?.substring(0, 3) + '***');

    try {
      const scraper = createScraper({
        companyId: CompanyTypes.oneZero,
        startDate,
        combineInstallments: false,
        showBrowser: false,
      });

      const scrapeOptions: OneZeroScrapeOptions = {
        email: creds.email,
        password: creds.password,
      };

      // Use long-term token if available (library expects 'otpLongTermToken')
      if (longTermToken) {
        console.log('[OneZero] Using long-term OTP token');
        console.log('[OneZero] Token length:', longTermToken.length);
        console.log('[OneZero] Token preview:', longTermToken.substring(0, 20) + '...');
        scrapeOptions.otpLongTermToken = longTermToken;
      } else {
        console.warn('[OneZero] No long-term token available - this will require interactive OTP which is not supported in this flow');
        return {
          success: false,
          errorType: 'AUTH_REQUIRED',
          errorMessage: 'No long-term token available. Please complete 2FA setup first.',
        };
      }

      console.log('[OneZero] Calling scraper.scrape() with options:', {
        hasEmail: !!scrapeOptions.email,
        hasPassword: !!scrapeOptions.password,
        hasOtpToken: !!scrapeOptions.otpLongTermToken,
      });

      try {
        // Cast to any to handle extended options
        const result = await scraper.scrape(scrapeOptions as Parameters<typeof scraper.scrape>[0]);

        console.log('[OneZero] Scrape result success:', result.success);
        if (!result.success) {
          console.error('[OneZero] Scrape failed:', result.errorType, result.errorMessage);

          // Add helpful message for potential token expiration
          const errorMsg = result.errorMessage || 'Authentication failed';
          const enhancedMessage = `${errorMsg}. If authentication continues to fail, your 2FA token may have expired - please re-authenticate.`;

          return {
            success: false,
            errorType: result.errorType,
            errorMessage: enhancedMessage,
          };
        }

        console.log('[OneZero] Scrape successful, accounts:', result.accounts?.length || 0);

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
          installments: txn.installments,
          status: txn.status === 'pending' ? 'pending' : 'completed',
        })),
      }));

        const totalTxns = accounts.reduce((sum, acc) => sum + acc.txns.length, 0);
        console.log('[OneZero] Mapped accounts:', accounts.length, 'with total transactions:', totalTxns);

        return {
          success: true,
          accounts,
        };
      } catch (scrapeError) {
        console.error('[OneZero] Scrape execution error:', scrapeError);
        const errorMessage = scrapeError instanceof Error ? scrapeError.message : 'Unknown error';
        const errorStack = scrapeError instanceof Error ? scrapeError.stack : undefined;

        if (errorStack) {
          console.error('[OneZero] Error stack:', errorStack);
        }

        return {
          success: false,
          errorType: 'EXCEPTION',
          errorMessage: `OneZero scrape failed: ${errorMessage}`,
        };
      }
    } catch (error) {
      console.error('[OneZero] Outer exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        errorType: 'EXCEPTION',
        errorMessage: `OneZero scrape failed: ${errorMessage}`,
      };
    }
  }

  async initTwoFactor(credentials: object): Promise<TwoFactorInitResult> {
    const creds = credentials as OneZeroCredentials;

    // Clean up old sessions first
    cleanupStaleSessions();

    // Ensure phone number is in international format
    let phoneNumber = creds.phoneNumber.trim();
    if (!phoneNumber.startsWith('+')) {
      // Convert Israeli local format to international
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '+972' + phoneNumber.substring(1);
      } else {
        phoneNumber = '+972' + phoneNumber;
      }
    }

    try {
      console.log(`[OneZero] Initiating 2FA with phone: ${phoneNumber}`);

      // Create a scraper instance - this maintains the internal state needed for 2FA
      const scraper = createScraper({
        companyId: CompanyTypes.oneZero,
        startDate: new Date(), // Not used for 2FA, but required
        combineInstallments: false,
        showBrowser: false,
      });

      // Use the library's built-in method to trigger 2FA
      console.log('[OneZero] Calling scraper.triggerTwoFactorAuth()...');
      const triggerResult = await scraper.triggerTwoFactorAuth(phoneNumber);

      if (!triggerResult.success) {
        console.error('[OneZero] Failed to trigger 2FA:', triggerResult.errorMessage);
        return {
          success: false,
          errorMessage: triggerResult.errorMessage || 'Failed to send OTP',
        };
      }

      console.log('[OneZero] OTP sent successfully');

      // Generate a session ID and store the scraper instance
      // The scraper maintains internal state (otpContext) needed for completion
      const sessionId = `onezero_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      pending2FASessions.set(sessionId, {
        scraper,
        createdAt: new Date(),
        phoneNumber,
      });

      console.log(`[OneZero] Stored 2FA session: ${sessionId}`);

      return {
        success: true,
        sessionId, // Return session ID so client can pass it to completeTwoFactor
      };
    } catch (error) {
      console.error('[OneZero] Error initiating 2FA:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to initiate 2FA',
      };
    }
  }

  async completeTwoFactor(
    _credentials: object,
    otpCode: string,
    sessionId?: string
  ): Promise<TwoFactorCompleteResult> {
    try {
      console.log(`[OneZero] Completing 2FA with OTP code, sessionId: ${sessionId}`);

      // Get the stored scraper from the session
      if (!sessionId || !pending2FASessions.has(sessionId)) {
        console.error('[OneZero] No session found for sessionId:', sessionId);
        return {
          success: false,
          errorMessage: 'Session expired or not found. Please start 2FA again.',
        };
      }

      const session = pending2FASessions.get(sessionId)!;
      const { scraper } = session;

      // Clean up the session
      pending2FASessions.delete(sessionId);

      console.log('[OneZero] Found scraper instance, getting long-term token...');

      // Use the library's built-in method to get the long-term token
      // The scraper maintains the otpContext from triggerTwoFactorAuth
      const tokenResult = await scraper.getLongTermTwoFactorToken(otpCode);

      console.log('[OneZero] getLongTermTwoFactorToken result:', {
        success: tokenResult.success,
        hasToken: tokenResult.success && 'longTermTwoFactorAuthToken' in tokenResult,
        tokenLength: tokenResult.success && 'longTermTwoFactorAuthToken' in tokenResult
          ? tokenResult.longTermTwoFactorAuthToken?.length
          : 0,
      });

      if (!tokenResult.success) {
        const errorMsg = 'errorMessage' in tokenResult ? tokenResult.errorMessage : 'Failed to verify OTP code';
        console.error('[OneZero] Failed to get long-term token:', errorMsg);
        return {
          success: false,
          errorMessage: errorMsg,
        };
      }

      if (!tokenResult.longTermTwoFactorAuthToken) {
        console.error('[OneZero] No long-term token in response');
        return {
          success: false,
          errorMessage: 'Failed to obtain long-term token',
        };
      }

      console.log('[OneZero] Successfully obtained long-term token, length:', tokenResult.longTermTwoFactorAuthToken.length);

      return {
        success: true,
        longTermToken: tokenResult.longTermTwoFactorAuthToken,
      };
    } catch (error) {
      console.error('[OneZero] Error completing 2FA:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to complete 2FA',
      };
    }
  }
}

// Register the adapter
registerAdapter(new OneZeroAdapter());

export { OneZeroAdapter };

