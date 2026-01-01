/**
 * Chromium configuration for Vercel/AWS Lambda environments
 * Uses @sparticuz/chromium when available for serverless deployments
 */

import type { LaunchOptions } from 'puppeteer-core';

/**
 * Get Puppeteer launch options for the current environment
 * - In Vercel/production: uses @sparticuz/chromium
 * - In development: uses local Chrome installation
 */
export async function getChromiumLaunchOptions(): Promise<LaunchOptions> {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';

  if (isProduction || isVercel) {
    try {
      // Dynamically import @sparticuz/chromium (only in production)
      const chromium = await import('@sparticuz/chromium');

      console.log('[Chromium] Using @sparticuz/chromium for Vercel/Lambda');

      return {
        executablePath: await chromium.default.executablePath(),
        args: chromium.default.args,
        headless: chromium.default.headless,
      };
    } catch (error) {
      console.error('[Chromium] Failed to load @sparticuz/chromium:', error);
      console.log('[Chromium] Falling back to default Chromium');

      // Fallback to default
      return {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
    }
  }

  // Development: use local Chrome
  console.log('[Chromium] Using local Chrome installation');
  return {
    headless: true,
  };
}
