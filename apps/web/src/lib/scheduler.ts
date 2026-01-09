/**
 * Bank Sync Scheduler
 *
 * This module provides startup sync functionality for local development.
 * In production (Vercel), syncing is handled by:
 * 1. Vercel cron jobs (/api/cron/sync) - runs daily
 * 2. On-access stale sync (checkAndSync tRPC) - runs on user activity
 *
 * NOTE: node-cron has been removed as it doesn't work on Vercel serverless.
 * The cron schedule "0 3 * * *" in vercel.json runs at 6 AM Israel time (UTC+3).
 *
 * IMPORTANT: All imports are dynamic to avoid Prisma initialization during Next.js build.
 */

let isInitialized = false;

/**
 * Initialize scheduler for local development
 * In production, this only logs status - actual syncing is done via cron
 */
export async function initScheduler(): Promise<void> {
  if (isInitialized) {
    console.log('[Scheduler] Already initialized, skipping');
    return;
  }

  console.log('[Scheduler] Initializing bank sync service');
  console.log('[Scheduler] Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
  });

  isInitialized = true;

  // On Vercel, cron handles the scheduled sync
  if (process.env.VERCEL === '1') {
    console.log('[Scheduler] Running on Vercel - sync handled by cron job at /api/cron/sync');
    console.log('[Scheduler] Cron schedule: 0 3 * * * (6 AM Israel time daily)');
    return;
  }

  // In local development, check for stale connections on startup
  console.log('[Scheduler] Local development mode - checking for stale connections on startup');

  try {
    await checkAndSyncAllStaleConnections();
  } catch (error) {
    console.error('[Scheduler] Error during startup sync check:', error);
  }

  console.log('[Scheduler] Initialization complete');
}

/**
 * Check and sync stale connections across all households
 * Used during local development startup
 *
 * Uses dynamic imports to avoid Prisma initialization during build
 */
async function checkAndSyncAllStaleConnections(): Promise<void> {
  console.log('[Scheduler] Checking for stale connections...');

  // Dynamic import to avoid build-time Prisma initialization
  const { prisma } = await import('@sfam/db');
  const { syncStaleConnectionsForHousehold, hasStaleConnections } = await import('./sync-service');

  // Get all households with active connections
  const households = await prisma.household.findMany({
    where: {
      bankConnections: {
        some: { isActive: true },
      },
    },
    select: { id: true, name: true },
  });

  if (households.length === 0) {
    console.log('[Scheduler] No households with active connections found');
    return;
  }

  console.log(`[Scheduler] Found ${households.length} household(s) with active connections`);

  for (const household of households) {
    try {
      const hasStale = await hasStaleConnections(household.id, 12);

      if (hasStale) {
        console.log(
          `[Scheduler] Syncing stale connections for household: ${household.name || household.id}`
        );
        const result = await syncStaleConnectionsForHousehold(household.id, 12);
        console.log(`[Scheduler] Result: ${result.message}`);
      } else {
        console.log(`[Scheduler] Household ${household.name || household.id} is up to date`);
      }
    } catch (error) {
      console.error(`[Scheduler] Error syncing household ${household.id}:`, error);
    }
  }
}
