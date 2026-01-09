import { NextResponse } from 'next/server';

/**
 * Vercel Cron Job endpoint for syncing all bank connections
 *
 * This endpoint is called by Vercel's cron scheduler (configured in vercel.json)
 * Security: Validates CRON_SECRET header to prevent unauthorized access
 *
 * NOTE: sync-service is dynamically imported to avoid Prisma initialization during build
 *
 * @see https://vercel.com/docs/cron-jobs
 */
export const maxDuration = 300; // 5 minutes max for Pro plan, adjust if needed
export const dynamic = 'force-dynamic';

// Type definition for the response (avoiding build-time import)
interface CronSyncResult {
  success: boolean;
  message: string;
  syncedConnections: number;
  totalTransactionsNew: number;
  totalTransactionsFound?: number;
  errors: string[];
  duration?: number;
  details?: Array<{
    connectionId: string;
    displayName: string;
    success: boolean;
    transactionsNew?: number;
    error?: string;
  }>;
}

export async function GET(request: Request): Promise<NextResponse<CronSyncResult>> {
  const startTime = Date.now();

  console.log('[Cron/Sync] Received cron sync request');

  // Validate CRON_SECRET for security
  // Vercel automatically sends this header for cron jobs
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, CRON_SECRET must be set
  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    console.error('[Cron/Sync] CRON_SECRET not configured');
    return NextResponse.json(
      {
        success: false,
        message: 'Server misconfiguration: CRON_SECRET not set',
        syncedConnections: 0,
        totalTransactionsNew: 0,
        errors: ['CRON_SECRET environment variable not configured'],
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }

  // Validate authorization header
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron/Sync] Unauthorized request - invalid CRON_SECRET');
    return NextResponse.json(
      {
        success: false,
        message: 'Unauthorized',
        syncedConnections: 0,
        totalTransactionsNew: 0,
        errors: ['Invalid or missing authorization'],
        duration: Date.now() - startTime,
      },
      { status: 401 }
    );
  }

  // Skip sync in demo mode
  if (process.env.DEMO_MODE === 'true') {
    console.log('[Cron/Sync] Skipping sync in demo mode');
    return NextResponse.json({
      success: true,
      message: 'Skipped: Demo mode active',
      syncedConnections: 0,
      totalTransactionsNew: 0,
      errors: [],
      duration: Date.now() - startTime,
    });
  }

  try {
    console.log('[Cron/Sync] Starting sync for all connections...');

    // Dynamic import to avoid Prisma initialization during build
    const { syncAllConnectionsForCron } = await import('@/lib/sync-service');
    const result = await syncAllConnectionsForCron();

    const duration = Date.now() - startTime;
    console.log(`[Cron/Sync] Completed in ${duration}ms:`, {
      synced: result.syncedConnections,
      newTransactions: result.totalTransactionsNew,
      errors: result.errors.length,
    });

    return NextResponse.json({
      ...result,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[Cron/Sync] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        message: `Sync failed: ${errorMessage}`,
        syncedConnections: 0,
        totalTransactionsNew: 0,
        errors: [errorMessage],
        duration,
      },
      { status: 500 }
    );
  }
}
