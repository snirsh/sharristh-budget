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
import { getScraperBrowserOptions } from '../chromium-config';

// Extended scrape options to include long-term 2FA token
// The library expects 'otpLongTermToken' for the long-term token
// and 'email' (not 'username') for the email
type OneZeroScrapeOptions = {
  email: string;
  password: string;
  otpLongTermToken?: string;
};

// Store pending 2FA scraper instances by session ID
// We need to keep the scraper instance alive to maintain the otpContext state
type Pending2FASession = {
  scraper: ReturnType<typeof createScraper>;
  createdAt: Date;
  phoneNumber: string;
};

const pending2FASessions = new Map<string, Pending2FASession>();

// Clean up old sessions (older than 10 minutes)
const cleanupStaleSessions = () => {
  const now = new Date();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [sessionId, session] of pending2FASessions.entries()) {
    if (now.getTime() - session.createdAt.getTime() > maxAge) {
      console.log(`[OneZero] Cleaning up stale 2FA session: ${sessionId}`);
      pending2FASessions.delete(sessionId);
    }
  }
};

/**
 * Check if a token looks valid and has expected structure
 */
const validateToken = (token: string): { valid: boolean; reason?: string } => {
  if (!token || token.length < 10) {
    return { valid: false, reason: 'Token is empty or too short' };
  }

  // If it's a JSON token, validate structure
  if (token.startsWith('{')) {
    try {
      const tokenObj = JSON.parse(token);
      
      // The library expects specific fields in the token
      // Check for common OAuth token fields
      if (!tokenObj.idToken && !tokenObj.accessToken && !tokenObj.refreshToken) {
        return { 
          valid: false, 
          reason: `Token JSON missing expected fields. Has: ${Object.keys(tokenObj).join(', ')}` 
        };
      }
      
      return { valid: true };
    } catch {
      return { valid: false, reason: 'Token looks like JSON but failed to parse' };
    }
  }

  // Non-JSON tokens are assumed valid (could be JWT or other format)
  return { valid: true };
};

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

    // Validate token before attempting scrape
    if (!longTermToken) {
      console.warn('[OneZero] No long-term token available - this will require interactive OTP which is not supported in this flow');
      return {
        success: false,
        errorType: 'AUTH_REQUIRED',
        errorMessage: 'No long-term token available. Please complete 2FA setup first.',
      };
    }

    // Validate token structure
    const tokenValidation = validateToken(longTermToken);
    if (!tokenValidation.valid) {
      console.error('[OneZero] Token validation failed:', tokenValidation.reason);
      return {
        success: false,
        errorType: 'AUTH_REQUIRED',
        errorMessage: `Invalid 2FA token: ${tokenValidation.reason}. Please re-authenticate.`,
      };
    }

    try {
      // Get browser options optimized for Vercel/serverless environments
      const browserOptions = await getScraperBrowserOptions();

      console.log('[OneZero] Browser options:', {
        hasExecutablePath: !!browserOptions.executablePath,
        argsCount: browserOptions.args?.length || 0,
        showBrowser: browserOptions.showBrowser,
      });

      // Create scraper with browser options
      const scraper = createScraper({
        companyId: CompanyTypes.oneZero,
        startDate,
        combineInstallments: false,
        showBrowser: browserOptions.showBrowser ?? false,
        executablePath: browserOptions.executablePath,
        args: browserOptions.args,
      });

      const scrapeOptions: OneZeroScrapeOptions = {
        email: creds.email,
        password: creds.password,
        otpLongTermToken: longTermToken,
      };

      console.log('[OneZero] Token details:', {
        length: longTermToken.length,
        isJson: longTermToken.startsWith('{'),
        preview: longTermToken.substring(0, 30) + '...',
      });

      console.log('[OneZero] Calling scraper.scrape() with options:', {
        hasEmail: !!scrapeOptions.email,
        hasPassword: !!scrapeOptions.password,
        hasOtpToken: !!scrapeOptions.otpLongTermToken,
        emailLength: scrapeOptions.email?.length || 0,
        passwordLength: scrapeOptions.password?.length || 0,
      });

      try {
        // Cast to any to handle extended options
        console.log('[OneZero] About to call scraper.scrape()...');
        const result = await scraper.scrape(scrapeOptions as Parameters<typeof scraper.scrape>[0]);
        console.log('[OneZero] scraper.scrape() returned');

        console.log('[OneZero] Scrape result success:', result.success);
        if (!result.success) {
          console.error('[OneZero] Scrape failed:', result.errorType, result.errorMessage);

          // Detect token-related errors and provide helpful message
          const errorMsg = result.errorMessage || 'Authentication failed';
          const isTokenError = 
            errorMsg.includes('idToken') || 
            errorMsg.includes('token') || 
            errorMsg.includes('auth') ||
            errorMsg.includes('undefined') ||
            result.errorType === 'INVALID_PASSWORD' ||
            result.errorType === 'CHANGE_PASSWORD';

          const enhancedMessage = isTokenError
            ? `${errorMsg}. Your 2FA token appears to be expired or invalid - please re-authenticate.`
            : `${errorMsg}. If authentication continues to fail, your 2FA token may have expired - please re-authenticate.`;

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

        // Check if this is a token-related error (like "Cannot read properties of undefined (reading 'idToken')")
        const isTokenError = 
          errorMessage.includes('idToken') || 
          errorMessage.includes('Cannot read properties of undefined');

        if (isTokenError) {
          return {
            success: false,
            errorType: 'AUTH_REQUIRED',
            errorMessage: `Authentication token is invalid or expired. Please re-authenticate by completing 2FA setup again.`,
          };
        }

        return {
          success: false,
          errorType: 'EXCEPTION',
          errorMessage: `OneZero scrape failed: ${errorMessage}. If this persists, try re-authenticating.`,
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

      // Get browser options optimized for Vercel/serverless environments
      const browserOptions = await getScraperBrowserOptions();

      console.log('[OneZero 2FA] Browser options:', {
        hasExecutablePath: !!browserOptions.executablePath,
        argsCount: browserOptions.args?.length || 0,
      });

      // Create a scraper instance - this maintains the internal state needed for 2FA
      const scraper = createScraper({
        companyId: CompanyTypes.oneZero,
        startDate: new Date(), // Not used for 2FA, but required
        combineInstallments: false,
        showBrowser: browserOptions.showBrowser ?? false,
        executablePath: browserOptions.executablePath,
        args: browserOptions.args,
      });

      // Use the library's built-in method to trigger 2FA
      console.log('[OneZero] Calling scraper.triggerTwoFactorAuth()...');
      const triggerResult = await scraper.triggerTwoFactorAuth(phoneNumber);

      if (!triggerResult.success) {
        const errorMsg = 'errorMessage' in triggerResult ? triggerResult.errorMessage : 'Failed to send OTP';
        console.error('[OneZero] Failed to trigger 2FA:', errorMsg);
        return {
          success: false,
          errorMessage: errorMsg || 'Failed to send OTP',
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
        resultKeys: Object.keys(tokenResult),
      });

      // Log the token structure for debugging (without sensitive data)
      if (tokenResult.success && 'longTermTwoFactorAuthToken' in tokenResult && tokenResult.longTermTwoFactorAuthToken) {
        const token = tokenResult.longTermTwoFactorAuthToken;
        console.log('[OneZero] Token received:', {
          length: token.length,
          isJson: token.startsWith('{'),
          preview: token.substring(0, 50) + '...',
        });

        if (token.startsWith('{')) {
          try {
            const tokenObj = JSON.parse(token);
            console.log('[OneZero] Token structure:', Object.keys(tokenObj));
          } catch {
            console.log('[OneZero] Token is not valid JSON');
          }
        }
      }

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

      // Note: We can't validate email/password during 2FA completion because
      // the library's login() method would close the browser and we'd lose state.
      // The credentials will be validated during the first sync.
      // If the sync fails with an auth error, the user will need to check their credentials.

      return {
        success: true,
        longTermToken: tokenResult.longTermTwoFactorAuthToken,
      };
    } catch (error) {
      console.error('[OneZero] Error completing 2FA:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete 2FA';
      
      // Check if this is a session-related error (common on serverless)
      if (errorMessage.includes('otpContext') || errorMessage.includes('undefined')) {
        return {
          success: false,
          errorMessage: 'Session state lost. This can happen on serverless platforms. Please try the 2FA process again.',
        };
      }
      
      return {
        success: false,
        errorMessage,
      };
    }
  }
}

// Register the adapter
registerAdapter(new OneZeroAdapter());

export { OneZeroAdapter };

