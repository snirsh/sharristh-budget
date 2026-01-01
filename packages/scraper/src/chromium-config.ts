/**
 * Chromium configuration for Vercel/AWS Lambda environments
 * Uses @sparticuz/chromium when available for serverless deployments
 */

/**
 * Options compatible with israeli-bank-scrapers createScraper()
 */
export type ScraperBrowserOptions = {
  executablePath?: string;
  args?: string[];
  showBrowser?: boolean;
};

/**
 * Default args for running Chromium in serverless/sandboxed environments
 * These are required when running without a proper sandbox
 */
const SERVERLESS_CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--single-process',
  '--no-zygote',
];

/**
 * Get browser options for israeli-bank-scrapers createScraper()
 * - In Vercel/production: uses @sparticuz/chromium with appropriate args
 * - In development: uses system Chrome with default options
 */
export const getScraperBrowserOptions = async (): Promise<ScraperBrowserOptions> => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';

  if (isProduction || isVercel) {
    try {
      // Dynamically import @sparticuz/chromium (only in production)
      const chromium = await import('@sparticuz/chromium');
      
      // Get executable path
      const executablePath = await chromium.default.executablePath();
      
      // Get the optimized args from @sparticuz/chromium
      // These are specifically designed for Lambda/serverless environments
      const args = chromium.default.args;

      console.log('[Chromium] Using @sparticuz/chromium for Vercel/Lambda');
      console.log('[Chromium] executablePath:', executablePath);
      console.log('[Chromium] args count:', args.length);

      return {
        executablePath,
        args,
        showBrowser: false,
      };
    } catch (error) {
      console.error('[Chromium] Failed to load @sparticuz/chromium:', error);
      console.log('[Chromium] Falling back to serverless args without custom executable');

      // Fallback: use default puppeteer chromium with serverless-safe args
      return {
        args: SERVERLESS_CHROMIUM_ARGS,
        showBrowser: false,
      };
    }
  }

  // Development: use local Chrome with default options
  console.log('[Chromium] Using local Chrome installation (development mode)');
  return {
    showBrowser: false,
  };
};

/**
 * @deprecated Use getScraperBrowserOptions instead
 * Legacy function for backward compatibility
 */
export const getChromiumLaunchOptions = getScraperBrowserOptions;
