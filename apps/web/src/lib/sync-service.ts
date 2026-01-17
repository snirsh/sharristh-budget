/**
 * Bank Connection Sync Service
 *
 * Core sync logic extracted from scheduler.ts for use by:
 * - Vercel cron jobs (/api/cron/sync)
 * - Manual sync triggers (tRPC syncAll)
 * - On-access stale sync (checkAndSync)
 *
 * This module is stateless and can be imported in serverless environments.
 *
 * Features:
 * - Automatic AI categorization during sync (with rate limiting)
 * - Auto-creation of categorization rules from high-confidence AI suggestions
 */

import { prisma } from '@sfam/db';
import { categorizeTransaction } from '@sfam/domain';
import type { CategoryForCategorization } from '@sfam/domain';
import { type BankProvider, type MappedTransaction, scraperService } from '@sfam/scraper';

// AI rate limiting: Gemini allows 15 req/min, use 4.5s delay (~13 req/min to be safe)
const AI_RATE_LIMIT_DELAY_MS = 4500;

export interface CronSyncDetail {
  connectionId: string;
  displayName: string;
  success: boolean;
  transactionsNew?: number;
  aiCategorized?: number;
  error?: string;
}

export interface CronSyncResult {
  success: boolean;
  message: string;
  syncedConnections: number;
  totalTransactionsNew: number;
  totalTransactionsFound?: number;
  totalAICategorized?: number;
  errors: string[];
  duration?: number;
  details?: Array<CronSyncDetail>;
}

export interface ConnectionSyncResult {
  success: boolean;
  transactionsFound: number;
  transactionsNew: number;
  aiCategorized: number;
  errorMessage?: string;
}

/**
 * Sync all active bank connections across all households
 * Used by the cron job endpoint
 */
export async function syncAllConnectionsForCron(): Promise<CronSyncResult> {
  console.log('[SyncService] Starting cron sync for all connections');

  const households: { id: string }[] = await prisma.household.findMany({
    where: {
      bankConnections: { some: { isActive: true } },
    },
    select: { id: true },
  });

  console.log(`[SyncService] Found ${households.length} households to sync`);

  const results = await Promise.all(
    households.map(async (household: { id: string }) => {
      const connections = await prisma.bankConnection.findMany({
        where: { isActive: true, householdId: household.id },
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
      let totalAICategorized = 0;
      let successCount = 0;

      for (const connection of connections) {
        try {
          console.log(
            `[SyncService] Syncing connection ${connection.id} (${connection.displayName})`
          );

          const result = await syncSingleConnection({
            id: connection.id,
            householdId: connection.householdId,
            provider: connection.provider,
            encryptedCreds: connection.encryptedCreds,
            longTermToken: connection.longTermToken,
            accountMappings: connection.accountMappings,
            lastSyncAt: connection.lastSyncAt,
          });

          if (result.success) {
            successCount++;
            totalNew += result.transactionsNew;
            totalFound += result.transactionsFound;
            totalAICategorized += result.aiCategorized;
          } else {
            errors.push(`${connection.displayName}: ${result.errorMessage}`);
          }

          results?.push({
            connectionId: connection.id,
            displayName: connection.displayName,
            success: result.success,
            transactionsNew: result.transactionsNew,
            aiCategorized: result.aiCategorized,
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

      console.log(
        `[SyncService] Completed: ${successCount}/${connections.length} successful, ${totalNew} new transactions, ${totalAICategorized} AI-categorized`
      );

      return {
        success: successCount > 0 || connections.length === 0,
        message: `Synced ${successCount}/${connections.length} connections`,
        syncedConnections: successCount,
        totalTransactionsNew: totalNew,
        totalTransactionsFound: totalFound,
        totalAICategorized,
        errors,
        details: results.map((r) => {
          return {
            connectionId: r.connectionId,
            displayName: r.displayName,
            success: r.success,
            transactionsNew: r.transactionsNew,
            aiCategorized: r.aiCategorized,
            error: r.error,
          };
        }),
      };
    })
  );

  const totalConnections = results.length;
  const totalSuccess = results.filter((r) => r.success).length;
  const totalNew = results.reduce((sum, r) => sum + (r.totalTransactionsNew || 0), 0);
  const totalFound = results.reduce((sum, r) => sum + (r.totalTransactionsFound || 0), 0);
  const totalAICategorized = results.reduce((sum, r) => sum + (r.totalAICategorized || 0), 0);
  const errors = results.filter((r) => !r.success).flatMap((r) => r.errors);

  return {
    success: totalSuccess > 0,
    message: `Synced ${totalSuccess}/${totalConnections} connections`,
    syncedConnections: totalSuccess,
    totalTransactionsNew: totalNew,
    totalTransactionsFound: totalFound,
    totalAICategorized,
    errors,
    details: results.flatMap((r) => r.details),
  };
}

/**
 * Sync connections for a specific household that haven't synced recently
 * Used for on-access stale sync
 */
export async function syncStaleConnectionsForHousehold(
  householdId: string,
  staleThresholdHours = 12
): Promise<CronSyncResult> {
  console.log(`[SyncService] Checking stale connections for household ${householdId}`);

  const staleThreshold = new Date();
  staleThreshold.setHours(staleThreshold.getHours() - staleThresholdHours);

  const staleConnections = await prisma.bankConnection.findMany({
    where: {
      householdId,
      isActive: true,
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: staleThreshold } }],
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
  let totalAICategorized = 0;
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
        lastSyncAt: connection.lastSyncAt,
      });

      if (result.success) {
        successCount++;
        totalNew += result.transactionsNew;
        totalAICategorized += result.aiCategorized;
      } else {
        errors.push(`${connection.displayName}: ${result.errorMessage}`);
      }

      results?.push({
        connectionId: connection.id,
        displayName: connection.displayName,
        success: result.success,
        transactionsNew: result.transactionsNew,
        aiCategorized: result.aiCategorized,
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
    totalAICategorized,
    errors,
    details: results,
  };
}

/**
 * Check if any connections for a household need syncing
 */
export async function hasStaleConnections(
  householdId: string,
  staleThresholdHours = 12
): Promise<boolean> {
  const staleThreshold = new Date();
  staleThreshold.setHours(staleThreshold.getHours() - staleThresholdHours);

  const count = await prisma.bankConnection.count({
    where: {
      householdId,
      isActive: true,
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: staleThreshold } }],
    },
  });

  return count > 0;
}

/**
 * Sync a single bank connection
 * @param connection - The bank connection to sync
 * @param lastSyncAt - Optional date of last successful sync (for incremental fetching)
 */
async function syncSingleConnection(connection: {
  id: string;
  householdId: string;
  provider: string;
  encryptedCreds: string;
  longTermToken: string | null;
  accountMappings: string | null;
  lastSyncAt?: Date | null;
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

    // Calculate start date for fetching transactions
    // Use lastSyncAt with a 3-day buffer to catch delayed transactions
    // Falls back to scraper's default (90 days) if no previous sync
    let startDate: Date | undefined;
    if (connection.lastSyncAt) {
      startDate = new Date(connection.lastSyncAt);
      startDate.setDate(startDate.getDate() - 3); // 3-day buffer for delayed transactions
      console.log(
        `[SyncService] Fetching transactions since ${startDate.toISOString()} (last sync: ${connection.lastSyncAt.toISOString()})`
      );
    } else {
      console.log('[SyncService] No previous sync, using default lookback period');
    }

    // Perform the sync
    const { result, transactions } = await scraperService.syncConnection(
      {
        id: connection.id,
        provider: connection.provider as BankProvider,
        encryptedCreds: connection.encryptedCreds,
        longTermToken: connection.longTermToken,
      },
      existingExternalIds,
      startDate
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
        aiCategorized: 0,
        errorMessage: result.errorMessage,
      };
    }

    // Import new transactions with AI categorization
    let aiCategorized = 0;
    if (transactions.length > 0) {
      const importResult = await importTransactions(connection, transactions);
      aiCategorized = importResult.aiCategorized;
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
      `[SyncService] Sync completed for ${connection.id}: ${result.transactionsNew} new transactions, ${aiCategorized} AI-categorized`
    );

    return {
      success: true,
      transactionsFound: result.transactionsFound,
      transactionsNew: result.transactionsNew,
      aiCategorized,
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
 * Extract the most meaningful keyword from a description for rule creation
 * Returns the longest word (≥4 chars) that's likely to be a merchant/business name
 */
function extractKeyword(description: string): string | null {
  const words = description
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    // Filter out common Hebrew words and numbers
    .filter((w) => !/^\d+$/.test(w))
    .filter((w) => !['תשלום', 'העברה', 'משיכה', 'הפקדה', 'עמלה'].includes(w));

  if (words.length === 0) return null;

  // Return the longest word (likely to be the merchant name)
  return words.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * Helper to delay between operations
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Import transactions into the database with auto-categorization
 * Features:
 * - Rule-based categorization (fast, no rate limiting)
 * - AI categorization for uncategorized transactions (rate-limited)
 * - Auto-creates categorization rules from high-confidence AI suggestions
 */
async function importTransactions(
  connection: {
    householdId: string;
    accountMappings: string | null;
  },
  transactions: MappedTransaction[]
): Promise<{ aiCategorized: number }> {
  let aiCategorizedCount = 0;
  let aiCallCount = 0;

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

  // Get categories for AI categorization
  const categoriesRaw = await prisma.category.findMany({
    where: { householdId: connection.householdId, isActive: true },
    select: { id: true, name: true, type: true },
  });
  const categories: CategoryForCategorization[] = categoriesRaw.map((c) => ({
    ...c,
    type: c.type as 'income' | 'expense',
  }));

  // Check if AI is enabled
  const aiEnabled = !!process.env.GEMINI_API_KEY;
  const aiApiKey = process.env.GEMINI_API_KEY;

  if (aiEnabled) {
    console.log(
      `[SyncService] AI categorization enabled for sync (${transactions.length} transactions)`
    );
  }

  // Create transactions
  for (const txn of transactions) {
    const accountId = accountIdMap.get(txn.externalAccountId);
    if (!accountId) continue;

    try {
      // Try to use external category first
      let validCategoryId: string | null = null;
      let categorizationSource = 'fallback';
      let confidence = 0;

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
          confidence = 1;
        }
      }

      // If no external category, try rule-based categorization first (fast, no AI)
      if (!validCategoryId) {
        const ruleResult = await categorizeTransaction(
          {
            description: txn.description,
            merchant: txn.merchant,
            amount: txn.amount,
            direction: txn.direction,
          },
          rules,
          undefined, // No categories for rule-only check
          { enableAI: false }
        );

        // Only accept rule-based matches (not fallback)
        if (ruleResult.categoryId && ruleResult.source !== 'fallback') {
          const category = await prisma.category.findFirst({
            where: {
              id: ruleResult.categoryId,
              householdId: connection.householdId,
            },
          });

          if (category) {
            validCategoryId = category.id;
            categorizationSource = ruleResult.source;
            confidence = ruleResult.confidence;
          }
        }
      }

      // If still no category and AI is enabled, try AI categorization (with rate limiting)
      if (!validCategoryId && aiEnabled && categories.length > 0) {
        // Apply rate limiting for AI calls
        if (aiCallCount > 0) {
          await delay(AI_RATE_LIMIT_DELAY_MS);
        }
        aiCallCount++;

        const aiResult = await categorizeTransaction(
          {
            description: txn.description,
            merchant: txn.merchant,
            amount: txn.amount,
            direction: txn.direction,
          },
          rules,
          categories,
          { enableAI: true, aiApiKey }
        );

        if (aiResult.categoryId && aiResult.source === 'ai_suggestion') {
          // Validate category exists in household
          const category = await prisma.category.findFirst({
            where: {
              id: aiResult.categoryId,
              householdId: connection.householdId,
            },
          });

          if (category) {
            validCategoryId = category.id;
            categorizationSource = 'ai_suggestion';
            confidence = aiResult.confidence;
            aiCategorizedCount++;

            // Auto-create rule from high-confidence AI suggestion (≥75%)
            // This helps the system "learn" and reduces future AI calls
            if (aiResult.confidence >= 0.75) {
              const rulePattern = txn.merchant || extractKeyword(txn.description);
              const ruleType = txn.merchant ? 'merchant' : 'keyword';

              if (rulePattern && rulePattern.length >= 3) {
                // Check if similar rule already exists
                const existingRule = await prisma.categoryRule.findFirst({
                  where: {
                    householdId: connection.householdId,
                    pattern: { contains: rulePattern, mode: 'insensitive' },
                  },
                });

                if (!existingRule) {
                  try {
                    await prisma.categoryRule.create({
                      data: {
                        householdId: connection.householdId,
                        categoryId: validCategoryId,
                        type: ruleType,
                        pattern: rulePattern,
                        priority: 5, // Medium priority - can be overridden by user rules
                        isActive: true,
                        createdFrom: 'ai_suggestion',
                      },
                    });
                    console.log(
                      `[SyncService] Auto-created ${ruleType} rule: "${rulePattern}" → category ${category.name}`
                    );
                  } catch (ruleError) {
                    // Rule creation failed, but transaction was categorized - continue
                    console.warn('[SyncService] Failed to create rule:', ruleError);
                  }
                }
              }
            }
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
          confidence: validCategoryId ? confidence : 0,
          needsReview: !validCategoryId || categorizationSource === 'ai_suggestion',
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

  if (aiCategorizedCount > 0) {
    console.log(
      `[SyncService] AI categorized ${aiCategorizedCount}/${transactions.length} transactions`
    );
  }

  return { aiCategorized: aiCategorizedCount };
}
