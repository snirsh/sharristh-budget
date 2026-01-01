/**
 * Next.js Instrumentation
 * This file is automatically loaded by Next.js when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export const register = async () => {
  // Only run on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing server-side services');
    console.log('[Instrumentation] Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      DEMO_MODE: process.env.DEMO_MODE,
    });

    // Set Chromium environment variables for Puppeteer BEFORE loading israeli-bank-scrapers
    // Note: The main configuration happens in chromium-config.ts which passes args directly
    // to the scraper. This is a fallback for any code that reads env vars directly.
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      try {
        const chromium = await import('@sparticuz/chromium');
        const executablePath = await chromium.default.executablePath();
        
        // Set executable path (some libraries look for this env var)
        process.env.PUPPETEER_EXECUTABLE_PATH = executablePath;
        
        console.log('[Instrumentation] Chromium configuration:', {
          executablePath,
          argsCount: chromium.default.args.length,
        });
      } catch (error) {
        console.error('[Instrumentation] Failed to configure Chromium:', error);
        console.log('[Instrumentation] Scraper will use fallback configuration');
      }
    }

    // Skip scheduler in demo mode (no bank connections in demo)
    if (process.env.DEMO_MODE !== 'true') {
      // Initialize the bank sync scheduler (includes auto-sync for stale connections)
      const { initScheduler } = await import('./lib/scheduler');
      await initScheduler();
    } else {
      console.log('[Instrumentation] Skipping scheduler in demo mode');
    }

    console.log('[Instrumentation] Server-side services initialized');
  }
};

