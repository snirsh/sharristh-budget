import cron from 'node-cron';
import { prisma } from '@sfam/db';
import { scraperService, type BankProvider, type MappedTransaction } from '@sfam/scraper';
import { categorizeTransaction } from '@sfam/domain';

let isSchedulerInitialized = false;

/**
 * Initialize the background scheduler for bank syncing
 * Should be called once when the server starts
 */
export async function initScheduler() {
  if (isSchedulerInitialized) {
    console.log('[Scheduler] Already initialized, skipping');
    return;
  }

  console.log('[Scheduler] Initializing bank sync scheduler');

  // Run twice daily at 6 AM and 6 PM Israel time for fresh transaction data
  // Cron format: minute hour day month weekday
  cron.schedule('0 6,18 * * *', async () => {
    const hour = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Jerusalem',
      hour: 'numeric',
      hour12: false
    });
    console.log(`[Scheduler] Starting scheduled bank sync at ${hour}:00 Israel time`);
    await syncAllConnections();
  }, {
    timezone: 'Asia/Jerusalem',
  });

  isSchedulerInitialized = true;
  console.log('[Scheduler] Bank sync scheduler initialized - runs twice daily at 6 AM and 6 PM Israel time');

  // Auto-sync on startup if connections haven't synced today
  // This is especially useful for local development where cron may not have run
  // Skip on Vercel to avoid Prisma initialization issues
  if (process.env.VERCEL !== '1') {
    await checkAndSyncStaleConnections();
  } else {
    console.log('[Scheduler] Skipping auto-sync on startup (Vercel environment)');
  }
}

/**
 * Check for connections that haven't synced today and sync them
 * Useful for local development where the server isn't always running
 */
async function checkAndSyncStaleConnections() {
  console.log('[Scheduler] Checking for stale connections that need sync...');

  // Get start of today in Israel timezone
  const now = new Date();
  const todayStart = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  todayStart.setHours(0, 0, 0, 0);

  // Find active connections that haven't synced today
  const staleConnections = await prisma.bankConnection.findMany({
    where: {
      isActive: true,
      OR: [
        { lastSyncAt: null },
        { lastSyncAt: { lt: todayStart } },
      ],
    },
    include: { household: true },
  });

  if (staleConnections.length === 0) {
    console.log('[Scheduler] All connections are up to date');
    return;
  }

  console.log(`[Scheduler] Found ${staleConnections.length} connection(s) that haven't synced today`);

  for (const connection of staleConnections) {
    try {
      console.log(`[Scheduler] Auto-syncing stale connection: ${connection.displayName}`);
      await syncConnection(connection);
    } catch (error) {
      console.error(`[Scheduler] Error auto-syncing connection ${connection.id}:`, error);
    }
  }

  console.log('[Scheduler] Completed auto-sync of stale connections');
}

/**
 * Sync all active bank connections
 */
export async function syncAllConnections() {
  console.log('[Scheduler] Fetching active bank connections');

  const connections = await prisma.bankConnection.findMany({
    where: { isActive: true },
    include: { household: true },
  });

  console.log(`[Scheduler] Found ${connections.length} active connections to sync`);

  for (const connection of connections) {
    try {
      console.log(`[Scheduler] Syncing connection ${connection.id} (${connection.displayName})`);
      await syncConnection(connection);
    } catch (error) {
      console.error(`[Scheduler] Error syncing connection ${connection.id}:`, error);
    }
  }

  console.log('[Scheduler] Completed scheduled bank sync');
}

/**
 * Sync a single bank connection
 */
async function syncConnection(connection: {
  id: string;
  householdId: string;
  provider: string;
  encryptedCreds: string;
  longTermToken: string | null;
  accountMappings: string | null;
}) {
  // Create a sync job
  const syncJob = await prisma.syncJob.create({
    data: {
      connectionId: connection.id,
      status: 'running',
      startedAt: new Date(),
    },
  });

  try {
    // Get existing external IDs for deduplication
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        householdId: connection.householdId,
        externalId: { not: null },
      },
      select: { externalId: true },
    });
    const existingExternalIds = new Set(
      existingTransactions.map((t) => t.externalId).filter((id): id is string => id !== null)
    );

    // Perform the sync
    const { result, transactions } = await scraperService.syncConnection(
      {
        id: connection.id,
        provider: connection.provider as BankProvider,
        encryptedCreds: connection.encryptedCreds,
        longTermToken: connection.longTermToken,
      },
      existingExternalIds
    );

    if (!result.success) {
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'error',
          completedAt: new Date(),
          errorMessage: result.errorMessage,
        },
      });

      await prisma.bankConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'error',
        },
      });

      console.error(`[Scheduler] Sync failed for ${connection.id}: ${result.errorMessage}`);
      return;
    }

    // Import new transactions
    if (transactions.length > 0) {
      await importTransactions(connection, transactions);
    }

    // Update sync job and connection
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'success',
        completedAt: new Date(),
        transactionsFound: result.transactionsFound,
        transactionsNew: result.transactionsNew,
      },
    });

    await prisma.bankConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
      },
    });

    console.log(
      `[Scheduler] Sync completed for ${connection.id}: ${result.transactionsNew} new transactions`
    );
  } catch (error) {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'error',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    await prisma.bankConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'error',
      },
    });

    throw error;
  }
}

/**
 * Import transactions into the database with auto-categorization
 */
async function importTransactions(
  connection: {
    householdId: string;
    accountMappings: string | null;
  },
  transactions: MappedTransaction[]
) {
  // Parse account mappings
  const accountMappings: Record<string, string> = connection.accountMappings
    ? JSON.parse(connection.accountMappings)
    : {};

  // Get or create accounts for unmapped external account IDs
  const externalAccountIds = [...new Set(transactions.map((t) => t.externalAccountId))];
  const accountIdMap = new Map<string, string>();

  for (const externalId of externalAccountIds) {
    if (accountMappings[externalId]) {
      accountIdMap.set(externalId, accountMappings[externalId]);
    } else {
      // Check if account with this external ID already exists
      const existingAccount = await prisma.account.findFirst({
        where: {
          householdId: connection.householdId,
          externalAccountId: externalId,
        },
      });

      if (existingAccount) {
        accountIdMap.set(externalId, existingAccount.id);
      } else {
        // Create a new account for this external ID
        const newAccount = await prisma.account.create({
          data: {
            householdId: connection.householdId,
            name: `Imported Account (${externalId})`,
            type: 'checking',
            externalAccountId: externalId,
          },
        });
        accountIdMap.set(externalId, newAccount.id);
      }
    }
  }

  // Get rules for auto-categorization
  const rulesRaw = await prisma.categoryRule.findMany({
    where: { householdId: connection.householdId, isActive: true },
  });
  const rules = rulesRaw.map((r) => ({
    ...r,
    type: r.type as 'merchant' | 'keyword' | 'regex',
  }));

  // Create transactions
  for (const txn of transactions) {
    const accountId = accountIdMap.get(txn.externalAccountId);
    if (!accountId) continue;

    // Auto-categorize
    const categorizationResult = await categorizeTransaction(
      {
        description: txn.description,
        merchant: txn.merchant,
        amount: txn.amount,
        direction: txn.direction,
      },
      rules
    );

    await prisma.transaction.create({
      data: {
        householdId: connection.householdId,
        accountId,
        date: txn.date,
        description: txn.description,
        merchant: txn.merchant,
        amount: txn.amount,
        direction: txn.direction,
        notes: txn.notes,
        externalId: txn.externalId,
        categoryId: categorizationResult.categoryId,
        categorizationSource: categorizationResult.categoryId ? 'imported' : 'fallback',
        confidence: categorizationResult.confidence,
        needsReview: categorizationResult.source === 'fallback',
      },
    });
  }
}

