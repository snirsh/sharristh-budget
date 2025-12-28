/**
 * Next.js Instrumentation
 * This file is automatically loaded by Next.js when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing server-side services');

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
}

