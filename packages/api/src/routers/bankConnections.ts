import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import {
  scraperService,
  oneZeroCredentialsSchema,
  israCardCredentialsSchema,
  type BankProvider,
  type MappedTransaction,
} from '@sfam/scraper';
import { categorizeTransaction } from '@sfam/domain';

// Schema for creating a new connection
const createConnectionSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('onezero'),
    displayName: z.string().min(1),
    credentials: oneZeroCredentialsSchema,
  }),
  z.object({
    provider: z.literal('isracard'),
    displayName: z.string().min(1),
    credentials: israCardCredentialsSchema,
  }),
]);

export const bankConnectionsRouter = router({
  /**
   * List all bank connections for the household
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const connections = await ctx.prisma.bankConnection.findMany({
      where: { householdId: ctx.householdId },
      select: {
        id: true,
        provider: true,
        displayName: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        isActive: true,
        createdAt: true,
        // Don't expose encrypted credentials
      },
      orderBy: { createdAt: 'desc' },
    });

    return connections.map((conn: typeof connections[number]) => ({
      ...conn,
      requiresTwoFactor: scraperService.requiresTwoFactor(conn.provider as BankProvider),
      providerDisplayName: scraperService.getProviderDisplayName(conn.provider as BankProvider),
    }));
  }),

  /**
   * Get a single connection by ID
   */
  byId: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const connection = await ctx.prisma.bankConnection.findFirst({
      where: {
        id: input,
        householdId: ctx.householdId,
      },
      select: {
        id: true,
        provider: true,
        displayName: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        isActive: true,
        accountMappings: true,
        createdAt: true,
      },
    });

    if (!connection) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
    }

    return {
      ...connection,
      accountMappings: connection.accountMappings
        ? JSON.parse(connection.accountMappings)
        : null,
      requiresTwoFactor: scraperService.requiresTwoFactor(connection.provider as BankProvider),
    };
  }),

  /**
   * Create a new bank connection
   */
  create: protectedProcedure.input(createConnectionSchema).mutation(async ({ ctx, input }) => {
    // Encrypt the credentials
    const encryptedCreds = scraperService.encryptCredentials(input.credentials);

    // Check if provider requires 2FA setup
    const requiresTwoFactor = scraperService.requiresTwoFactor(input.provider);

    const connection = await ctx.prisma.bankConnection.create({
      data: {
        householdId: ctx.householdId,
        provider: input.provider as string,
        displayName: input.displayName,
        encryptedCreds,
        isActive: !requiresTwoFactor, // Not active until 2FA is complete for OneZero
        lastSyncStatus: requiresTwoFactor ? 'pending' : null,
      },
    });

    return {
      id: connection.id,
      provider: connection.provider,
      displayName: connection.displayName,
      requiresTwoFactor,
      isActive: connection.isActive,
    };
  }),

  /**
   * Delete a bank connection
   */
  delete: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const connection = await ctx.prisma.bankConnection.findFirst({
      where: {
        id: input,
        householdId: ctx.householdId,
      },
    });

    if (!connection) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
    }

    await ctx.prisma.bankConnection.delete({
      where: { id: input },
    });

    return { success: true };
  }),

  /**
   * Initialize 2FA flow (send OTP to user's phone)
   * Only applicable for providers that require 2FA (e.g., OneZero)
   * Returns a sessionId that must be passed to completeTwoFactor
   */
  initTwoFactor: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.prisma.bankConnection.findFirst({
        where: {
          id: input.connectionId,
          householdId: ctx.householdId,
        },
      });

      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
      }

      const provider = connection.provider as BankProvider;
      if (!scraperService.requiresTwoFactor(provider)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This provider does not require 2FA',
        });
      }

      // Decrypt credentials for 2FA initialization
      const credentials = scraperService.decryptCredentials(connection.encryptedCreds);

      const result = await scraperService.initTwoFactor(provider, credentials);

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.errorMessage || 'Failed to initialize 2FA',
        });
      }

      // Return sessionId for stateful 2FA completion
      return { success: true, sessionId: result.sessionId };
    }),

  /**
   * Complete 2FA flow with OTP code
   * Returns and stores the long-term token
   * @param sessionId - Session ID returned from initTwoFactor (required for stateful 2FA)
   */
  completeTwoFactor: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        otpCode: z.string().min(4).max(10),
        sessionId: z.string().optional(), // Session ID from initTwoFactor
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.prisma.bankConnection.findFirst({
        where: {
          id: input.connectionId,
          householdId: ctx.householdId,
        },
      });

      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
      }

      const provider = connection.provider as BankProvider;
      const credentials = scraperService.decryptCredentials(connection.encryptedCreds);

      const result = await scraperService.completeTwoFactor(
        provider,
        credentials,
        input.otpCode,
        input.sessionId // Pass sessionId for stateful 2FA
      );

      if (!result.success || !result.longTermToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.errorMessage || 'Failed to complete 2FA',
        });
      }

      // Encrypt and store the long-term token
      const encryptedToken = scraperService.encryptToken(result.longTermToken);

      await ctx.prisma.bankConnection.update({
        where: { id: connection.id },
        data: {
          longTermToken: encryptedToken,
          isActive: true,
          lastSyncStatus: null,
        },
      });

      return { success: true };
    }),

  /**
   * Trigger a manual sync for a connection
   */
  syncNow: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        startDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.prisma.bankConnection.findFirst({
        where: {
          id: input.connectionId,
          householdId: ctx.householdId,
        },
      });

      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
      }

      if (!connection.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Connection is not active. Complete 2FA setup first.',
        });
      }

      // Create a sync job
      const syncJob = await ctx.prisma.syncJob.create({
        data: {
          connectionId: connection.id,
          status: 'running',
          startedAt: new Date(),
        },
      });

      try {
        // Get existing external IDs for deduplication
        const existingTransactions = await ctx.prisma.transaction.findMany({
          where: {
            householdId: ctx.householdId,
            externalId: { not: null },
          },
          select: { externalId: true },
        });
        const existingExternalIds = new Set<string>(
          existingTransactions.map((t: typeof existingTransactions[number]) => t.externalId).filter((id: string | null): id is string => id !== null)
        );

        // Perform the sync
        const { result, transactions } = await scraperService.syncConnection(
          {
            id: connection.id,
            provider: connection.provider as BankProvider,
            encryptedCreds: connection.encryptedCreds,
            longTermToken: connection.longTermToken,
          },
          existingExternalIds,
          input.startDate
        );

        if (!result.success) {
          // Check if this is an authentication error that requires re-authentication
          const isAuthError = 
            result.errorType === 'AUTH_REQUIRED' ||
            result.errorMessage?.includes('re-authenticate') ||
            result.errorMessage?.includes('expired') ||
            result.errorMessage?.includes('idToken') ||
            result.errorMessage?.includes('Cannot read properties of undefined');

          // Update sync job with error
          await ctx.prisma.syncJob.update({
            where: { id: syncJob.id },
            data: {
              status: 'error',
              completedAt: new Date(),
              errorMessage: result.errorMessage,
            },
          });

          // If auth error, mark connection as needing 2FA re-setup
          await ctx.prisma.bankConnection.update({
            where: { id: connection.id },
            data: {
              lastSyncAt: new Date(),
              lastSyncStatus: isAuthError ? 'auth_required' : 'error',
              // Deactivate connection if auth is required
              ...(isAuthError ? { isActive: false } : {}),
            },
          });

          throw new TRPCError({
            code: isAuthError ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR',
            message: result.errorMessage || 'Sync failed',
          });
        }

        // Import new transactions
        if (transactions.length > 0) {
          await importTransactions(ctx, transactions, connection);
        }

        // Update sync job and connection
        await ctx.prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: 'success',
            completedAt: new Date(),
            transactionsFound: result.transactionsFound,
            transactionsNew: result.transactionsNew,
          },
        });

        await ctx.prisma.bankConnection.update({
          where: { id: connection.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'success',
          },
        });

        return {
          success: true,
          transactionsFound: result.transactionsFound,
          transactionsNew: result.transactionsNew,
        };
      } catch (error) {
        // Update sync job with error
        await ctx.prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: 'error',
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        await ctx.prisma.bankConnection.update({
          where: { id: connection.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'error',
          },
        });

        throw error;
      }
    }),

  /**
   * Sync all active connections for the household
   */
  syncAll: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const connections = await ctx.prisma.bankConnection.findMany({
        where: {
          householdId: ctx.householdId,
          isActive: true,
        },
      });

      if (connections.length === 0) {
        return {
          success: true,
          message: 'No active connections to sync',
          results: [],
        };
      }

      const results: Array<{
        connectionId: string;
        displayName: string;
        success: boolean;
        transactionsFound?: number;
        transactionsNew?: number;
        errorMessage?: string;
      }> = [];

      for (const connection of connections) {
        try {
          // Create a sync job
          const syncJob = await ctx.prisma.syncJob.create({
            data: {
              connectionId: connection.id,
              status: 'running',
              startedAt: new Date(),
            },
          });

          // Get existing external IDs for deduplication
          const existingTransactions = await ctx.prisma.transaction.findMany({
            where: {
              householdId: ctx.householdId,
              externalId: { not: null },
            },
            select: { externalId: true },
          });
          const existingExternalIds = new Set<string>(
            existingTransactions.map((t: typeof existingTransactions[number]) => t.externalId).filter((id: string | null): id is string => id !== null)
          );

          // Perform the sync
          const { result, transactions } = await scraperService.syncConnection(
            {
              id: connection.id,
              provider: connection.provider as BankProvider,
              encryptedCreds: connection.encryptedCreds,
              longTermToken: connection.longTermToken,
            },
            existingExternalIds,
            input?.startDate
          );

          if (!result.success) {
            // Check if this is an authentication error that requires re-authentication
            const isAuthError = 
              result.errorType === 'AUTH_REQUIRED' ||
              result.errorMessage?.includes('re-authenticate') ||
              result.errorMessage?.includes('expired') ||
              result.errorMessage?.includes('idToken') ||
              result.errorMessage?.includes('Cannot read properties of undefined');

            await ctx.prisma.syncJob.update({
              where: { id: syncJob.id },
              data: {
                status: 'error',
                completedAt: new Date(),
                errorMessage: result.errorMessage,
              },
            });

            // If auth error, mark connection as needing 2FA re-setup
            await ctx.prisma.bankConnection.update({
              where: { id: connection.id },
              data: {
                lastSyncAt: new Date(),
                lastSyncStatus: isAuthError ? 'auth_required' : 'error',
                // Deactivate connection if auth is required
                ...(isAuthError ? { isActive: false } : {}),
              },
            });

            results.push({
              connectionId: connection.id,
              displayName: connection.displayName,
              success: false,
              errorMessage: isAuthError 
                ? `${result.errorMessage} Connection has been deactivated - please re-authenticate.`
                : result.errorMessage,
            });
            continue;
          }

          // Import new transactions
          if (transactions.length > 0) {
            await importTransactions(ctx, transactions, connection);
          }

          // Update sync job and connection
          await ctx.prisma.syncJob.update({
            where: { id: syncJob.id },
            data: {
              status: 'success',
              completedAt: new Date(),
              transactionsFound: result.transactionsFound,
              transactionsNew: result.transactionsNew,
            },
          });

          await ctx.prisma.bankConnection.update({
            where: { id: connection.id },
            data: {
              lastSyncAt: new Date(),
              lastSyncStatus: 'success',
            },
          });

          results.push({
            connectionId: connection.id,
            displayName: connection.displayName,
            success: true,
            transactionsFound: result.transactionsFound,
            transactionsNew: result.transactionsNew,
          });
        } catch (error) {
          console.error(`[SyncAll] Error syncing connection ${connection.id}:`, error);
          results.push({
            connectionId: connection.id,
            displayName: connection.displayName,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const totalNew = results.reduce((sum, r) => sum + (r.transactionsNew || 0), 0);
      const totalFound = results.reduce((sum, r) => sum + (r.transactionsFound || 0), 0);

      return {
        success: successCount > 0,
        message: `Synced ${successCount}/${connections.length} connections`,
        totalTransactionsFound: totalFound,
        totalTransactionsNew: totalNew,
        results,
      };
    }),

  /**
   * Get sync history for a connection
   */
  syncHistory: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        limit: z.number().min(1).max(100).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const connection = await ctx.prisma.bankConnection.findFirst({
        where: {
          id: input.connectionId,
          householdId: ctx.householdId,
        },
      });

      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
      }

      const jobs = await ctx.prisma.syncJob.findMany({
        where: { connectionId: connection.id },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });

      return jobs;
    }),

  /**
   * Update account mappings for a connection
   */
  updateAccountMappings: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        mappings: z.record(z.string()), // externalAccountId -> accountId
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.prisma.bankConnection.findFirst({
        where: {
          id: input.connectionId,
          householdId: ctx.householdId,
        },
      });

      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
      }

      // Verify all account IDs belong to the household
      const accountIds = Object.values(input.mappings);
      const accounts = await ctx.prisma.account.findMany({
        where: {
          id: { in: accountIds },
          householdId: ctx.householdId,
        },
      });

      if (accounts.length !== accountIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'One or more account IDs are invalid',
        });
      }

      await ctx.prisma.bankConnection.update({
        where: { id: connection.id },
        data: {
          accountMappings: JSON.stringify(input.mappings),
        },
      });

      return { success: true };
    }),

  /**
   * Get available providers
   */
  providers: protectedProcedure.query(() => {
    return [
      {
        id: 'onezero' as const,
        name: 'OneZero Bank',
        requiresTwoFactor: true,
        credentialFields: ['email', 'password', 'phoneNumber'],
      },
      {
        id: 'isracard' as const,
        name: 'Isracard',
        requiresTwoFactor: false,
        credentialFields: ['id', 'card6Digits', 'password'],
      },
    ];
  }),
});

/**
 * Import transactions into the database with auto-categorization
 */
async function importTransactions(
  ctx: { prisma: typeof import('@sfam/db').prisma; householdId: string },
  transactions: MappedTransaction[],
  connection: { id: string; accountMappings: string | null }
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
      // Verify the mapped account exists and belongs to this household
      const mappedAccount = await ctx.prisma.account.findFirst({
        where: {
          id: accountMappings[externalId],
          householdId: ctx.householdId,
        },
      });

      if (mappedAccount) {
        accountIdMap.set(externalId, mappedAccount.id);
      } else {
        console.warn(`[ImportTransactions] Mapped account ${accountMappings[externalId]} not found or doesn't belong to household, creating new account for ${externalId}`);
        // Create a new account since the mapping is invalid
        const newAccount = await ctx.prisma.account.create({
          data: {
            householdId: ctx.householdId,
            name: `Imported Account (${externalId})`,
            type: 'checking',
            externalAccountId: externalId,
          },
        });
        accountIdMap.set(externalId, newAccount.id);
      }
    } else {
      // Create a new account for this external ID
      console.log(`[ImportTransactions] Creating new account for external ID: ${externalId}`);
      const newAccount = await ctx.prisma.account.create({
        data: {
          householdId: ctx.householdId,
          name: `Imported Account (${externalId})`,
          type: 'checking',
          externalAccountId: externalId,
        },
      });
      accountIdMap.set(externalId, newAccount.id);
    }
  }

  // Get rules for auto-categorization
  const rulesRaw = await ctx.prisma.categoryRule.findMany({
    where: { householdId: ctx.householdId, isActive: true },
  });
  const rules = rulesRaw.map((r: typeof rulesRaw[number]) => ({
    ...r,
    type: r.type as 'merchant' | 'keyword' | 'regex',
  }));

  // Create transactions
  for (const txn of transactions) {
    const accountId = accountIdMap.get(txn.externalAccountId);
    if (!accountId) {
      console.warn(`[ImportTransactions] No account ID found for external account: ${txn.externalAccountId}, skipping transaction`);
      continue;
    }

    try {
      // Try to use external category (e.g., Isracard sector) first
      let validCategoryId: string | null = null;
      let categorizationSource: string = 'fallback';

      if (txn.externalCategory) {
        console.log(`[ImportTransactions] Transaction has external category: ${txn.externalCategory}`);

        // Look for existing category with this name
        let category = await ctx.prisma.category.findFirst({
          where: {
            householdId: ctx.householdId,
            name: txn.externalCategory,
            type: 'varying', // External categories from Isracard are expenses
          },
        });

        // If category doesn't exist, create it
        if (!category) {
          console.log(`[ImportTransactions] Auto-creating category from external: ${txn.externalCategory}`);

          // Get max sort order for varying categories
          const maxSort = await ctx.prisma.category.aggregate({
            where: {
              householdId: ctx.householdId,
              type: 'varying',
            },
            _max: { sortOrder: true },
          });

          try {
            category = await ctx.prisma.category.create({
              data: {
                householdId: ctx.householdId,
                name: txn.externalCategory,
                type: 'varying',
                icon: '📦', // Default icon for auto-created categories
                sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
                isSystem: false,
              },
            });
            console.log(`[ImportTransactions] Created category: ${category.name} (${category.id})`);
          } catch (createError) {
            console.error(`[ImportTransactions] Failed to create category "${txn.externalCategory}":`, createError);
            // Fall through to use rule-based categorization
            category = null;
          }
        }

        if (category) {
          validCategoryId = category.id;
          categorizationSource = 'imported';
        }
      }

      // If no external category or it failed, try rule-based categorization
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

        // Validate categoryId if present
        if (categorizationResult.categoryId) {
          const category = await ctx.prisma.category.findFirst({
            where: {
              id: categorizationResult.categoryId,
              householdId: ctx.householdId,
            },
          });

          if (category) {
            validCategoryId = category.id;
          } else {
            console.warn(`[ImportTransactions] Category ${categorizationResult.categoryId} not found or doesn't belong to household, setting to null`);
          }
        }
      }

      await ctx.prisma.transaction.create({
        data: {
          householdId: ctx.householdId,
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
      console.error(`[ImportTransactions] Failed to import transaction:`, {
        externalId: txn.externalId,
        description: txn.description,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue with other transactions instead of failing completely
    }
  }
}

