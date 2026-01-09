/**
 * Bank Connection Sync Service
 * 
 * Core sync logic extracted from scheduler.ts for use by:
 * - Vercel cron jobs (/api/cron/sync)
 * - Manual sync triggers (tRPC syncAll)
 * - On-access stale sync (checkAndSync)
 * 
 * This module is stateless and can be imported in serverless environments.
 */

import { prisma } from '@sfam/db';
import { scraperService, type BankProvider, type MappedTransaction } from '@sfam/scraper';
import { categorizeTransaction } from '@sfam/domain';

export interface CronSyncResult {
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

export interface ConnectionSyncResult {
  success: boolean;
  transactionsFound: number;
  transactionsNew: number;
  errorMessage?: string;
}

/**
 * Sync all active bank connections across all households
 * Used by the cron job endpoint
 */
export async function syncAllConnectionsForCron(): Promise<CronSyncResult> {
  console.log('[SyncService] Starting cron sync for all connections');

  const connections = await prisma.bankConnection.findMany({
    where: { isActive: true },
    include: { household: true },
  });

  console.log(`[SyncService] Found ${connections.length} active connections to sync`);

  if (connections.length === 0) {
    return {
      success: true,
      message: 'No active connections to sync',
      syncedConnections: 0,
      totalTransactionsNew: 0,
      errors: [],
      details: [],
    };
  }

  const results: CronSyncResult['details'] = [];
  const errors: string[] = [];
  let totalNew = 0;
  let totalFound = 0;
  let successCount = 0;

  for (const connection of connections) {
    try {
      console.log(`[SyncService] Syncing connection ${connection.id} (${connection.displayName})`);
      
      const result = await syncSingleConnection({
        id: connection.id,
        householdId: connection.householdId,
        provider: connection.provider,
        encryptedCreds: connection.encryptedCreds,
        longTermToken: connection.longTermToken,
        accountMappings: connection.accountMappings,
      });

      if (result.success) {
        successCount++;
        totalNew += result.transactionsNew;
        totalFound += result.transactionsFound;
      } else {
        errors.push(`${connection.displayName}: ${result.errorMessage}`);
      }

      results?.push({
        connectionId: connection.id,
        displayName: connection.displayName,
        success: result.success,
        transactionsNew: result.transactionsNew,
        error: result.errorMessage,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SyncService] Error syncing connection ${connection.id}:`, error);
      errors.push(`${connection.displayName}: ${errorMessage}`);
      
      results?.push({
        connectionId: connection.id,
        displayName: connection.displayName,
        success: false,
        error: errorMessage,
      });
    }
  }

  console.log(`[SyncService] Completed: ${successCount}/${connections.length} successful, ${totalNew} new transactions`);

  return {
    success: successCount > 0 || connections.length === 0,
    message: `Synced ${successCount}/${connections.length} connections`,
    syncedConnections: successCount,
    totalTransactionsNew: totalNew,
    totalTransactionsFound: totalFound,
    errors,
    details: results,
  };
}

/**
 * Sync connections for a specific household that haven't synced recently
 * Used for on-access stale sync
 */
export async function syncStaleConnectionsForHousehold(
  householdId: string,
  staleThresholdHours: number = 12
): Promise<CronSyncResult> {
  console.log(`[SyncService] Checking stale connections for household ${householdId}`);

  const staleThreshold = new Date();
  staleThreshold.setHours(staleThreshold.getHours() - staleThresholdHours);

  const staleConnections = await prisma.bankConnection.findMany({
    where: {
      householdId,
      isActive: true,
      OR: [
        { lastSyncAt: null },
        { lastSyncAt: { lt: staleThreshold } },
      ],
    },
  });

  if (staleConnections.length === 0) {
    console.log('[SyncService] No stale connections found');
    return {
      success: true,
      message: 'All connections are up to date',
      syncedConnections: 0,
      totalTransactionsNew: 0,
      errors: [],
    };
  }

  console.log(`[SyncService] Found ${staleConnections.length} stale connection(s)`);

  const results: CronSyncResult['details'] = [];
  const errors: string[] = [];
  let totalNew = 0;
  let successCount = 0;

  for (const connection of staleConnections) {
    try {
      const result = await syncSingleConnection({
        id: connection.id,
        householdId: connection.householdId,
        provider: connection.provider,
        encryptedCreds: connection.encryptedCreds,
        longTermToken: connection.longTermToken,
        accountMappings: connection.accountMappings,
      });

      if (result.success) {
        successCount++;
        totalNew += result.transactionsNew;
      } else {
        errors.push(`${connection.displayName}: ${result.errorMessage}`);
      }

      results?.push({
        connectionId: connection.id,
        displayName: connection.displayName,
        success: result.success,
        transactionsNew: result.transactionsNew,
        error: result.errorMessage,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${connection.displayName}: ${errorMessage}`);
    }
  }

  return {
    success: successCount > 0,
    message: `Synced ${successCount}/${staleConnections.length} stale connections`,
    syncedConnections: successCount,
    totalTransactionsNew: totalNew,
    errors,
    details: results,
  };
}

/**
 * Check if any connections for a household need syncing
 */
export async function hasStaleConnections(
  householdId: string,
  staleThresholdHours: number = 12
): Promise<boolean> {
  const staleThreshold = new Date();
  staleThreshold.setHours(staleThreshold.getHours() - staleThresholdHours);

  const count = await prisma.bankConnection.count({
    where: {
      householdId,
      isActive: true,
      OR: [
        { lastSyncAt: null },
        { lastSyncAt: { lt: staleThreshold } },
      ],
    },
  });

  return count > 0;
}

/**
 * Sync a single bank connection
 */
async function syncSingleConnection(connection: {
  id: string;
  householdId: string;
  provider: string;
  encryptedCreds: string;
  longTermToken: string | null;
  accountMappings: string | null;
}): Promise<ConnectionSyncResult> {
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
      // Check if this is an authentication error
      const isAuthError = 
        result.errorType === 'AUTH_REQUIRED' ||
        result.errorMessage?.includes('re-authenticate') ||
        result.errorMessage?.includes('expired') ||
        result.errorMessage?.includes('idToken');

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
          lastSyncStatus: isAuthError ? 'auth_required' : 'error',
        },
      });

      console.error(`[SyncService] Sync failed for ${connection.id}: ${result.errorMessage}`);
      return {
        success: false,
        transactionsFound: 0,
        transactionsNew: 0,
        errorMessage: result.errorMessage,
      };
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
      `[SyncService] Sync completed for ${connection.id}: ${result.transactionsNew} new transactions`
    );

    return {
      success: true,
      transactionsFound: result.transactionsFound,
      transactionsNew: result.transactionsNew,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'error',
        completedAt: new Date(),
        errorMessage,
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
): Promise<void> {
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

    try {
      // Try to use external category first
      let validCategoryId: string | null = null;
      let categorizationSource: string = 'fallback';

      if (txn.externalCategory) {
        // Look for existing category with this name
        let category = await prisma.category.findFirst({
          where: {
            householdId: connection.householdId,
            name: txn.externalCategory,
            type: 'expense',
          },
        });

        // If category doesn't exist, create it
        if (!category) {
          const maxSort = await prisma.category.aggregate({
            where: {
              householdId: connection.householdId,
              type: 'expense',
            },
            _max: { sortOrder: true },
          });

          try {
            category = await prisma.category.create({
              data: {
                householdId: connection.householdId,
                name: txn.externalCategory,
                type: 'expense',
                icon: '📦',
                sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
                isSystem: false,
              },
            });
          } catch {
            category = null;
          }
        }

        if (category) {
          validCategoryId = category.id;
          categorizationSource = 'imported';
        }
      }

      // If no external category, try rule-based categorization
      if (!validCategoryId) {
        const categorizationResult = await categorizeTransaction(
          {
            description: txn.description,
            merchant: txn.merchant,
            amount: txn.amount,
            direction: txn.direction,
          },
          rules
        );

        categorizationSource = categorizationResult.source;

        if (categorizationResult.categoryId) {
          const category = await prisma.category.findFirst({
            where: {
              id: categorizationResult.categoryId,
              householdId: connection.householdId,
            },
          });

          if (category) {
            validCategoryId = category.id;
          }
        }
      }

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
          categoryId: validCategoryId,
          categorizationSource: validCategoryId ? categorizationSource : 'fallback',
          confidence: validCategoryId ? 1 : 0,
          needsReview: !validCategoryId,
        },
      });
    } catch (error) {
      console.error(`[SyncService] Failed to import transaction:`, {
        externalId: txn.externalId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue with other transactions
    }
  }
}
