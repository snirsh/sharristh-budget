import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionFiltersSchema,
} from '@sfam/domain/schemas';
import { categorizeTransaction } from '@sfam/domain';

/**
 * Extract the most meaningful keyword from a description for rule creation
 * Returns the longest word (≥4 chars) that's likely to be a merchant/business name
 */
const extractKeyword = (description: string): string | null => {
  const words = description
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    // Filter out common Hebrew words and numbers
    .filter((w) => !/^\d+$/.test(w))
    .filter((w) => !['תשלום', 'העברה', 'משיכה', 'הפקדה', 'עמלה'].includes(w));

  if (words.length === 0) return null;

  // Return the longest word (likely to be the merchant name)
  return words.sort((a, b) => b.length - a.length)[0] ?? null;
};

export const transactionsRouter = router({
  /**
   * List transactions with filters
   */
  list: protectedProcedure.input(transactionFiltersSchema).query(async ({ ctx, input }) => {
    const where: Record<string, unknown> = {
      householdId: ctx.householdId,
    };

    // Filter out ignored transactions by default
    if (!input.includeIgnored) {
      where.isIgnored = false;
    }

    if (input.startDate) {
      where.date = { ...(where.date as Record<string, unknown> || {}), gte: input.startDate };
    }
    if (input.endDate) {
      where.date = { ...(where.date as Record<string, unknown> || {}), lte: input.endDate };
    }
    if (input.categoryId) {
      where.categoryId = input.categoryId;
    }
    if (input.accountId) {
      where.accountId = input.accountId;
    }
    if (input.direction) {
      where.direction = input.direction;
    }
    if (input.needsReview !== undefined) {
      where.needsReview = input.needsReview;
    }
    if (input.search) {
      where.OR = [
        { description: { contains: input.search, mode: 'insensitive' as const } },
        { merchant: { contains: input.search, mode: 'insensitive' as const } },
      ];
    }

    // Use cursor-based pagination if cursor is provided, otherwise use offset
    const queryOptions: any = {
      where,
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true, type: true },
        },
        account: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }], // Secondary sort by ID for stable ordering
      take: input.limit + 1, // Fetch one extra to check if there's more
    };

    // Cursor-based pagination (more efficient for large datasets)
    if (input.cursor) {
      queryOptions.cursor = { id: input.cursor };
      queryOptions.skip = 1; // Skip the cursor itself
    } else {
      // Offset-based pagination (for backward compatibility)
      queryOptions.skip = input.offset;
      queryOptions.take = input.limit; // Don't fetch extra for offset pagination
    }

    const [transactions, total] = await Promise.all([
      ctx.prisma.transaction.findMany(queryOptions),
      // Only count if using offset pagination (expensive query)
      input.cursor ? Promise.resolve(0) : ctx.prisma.transaction.count({ where }),
    ]);

    // Check if there are more results (for cursor pagination)
    const hasMore = input.cursor
      ? transactions.length > input.limit
      : input.offset + transactions.length < total;

    // Remove the extra item we fetched for hasMore check (cursor pagination only)
    const actualTransactions = input.cursor && transactions.length > input.limit
      ? transactions.slice(0, -1)
      : transactions;

    // Format data on server to reduce client-side computation
    const formattedTransactions = actualTransactions.map(tx => ({
      ...tx,
      // Pre-format currency on server (reduces client work)
      formattedAmount: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(tx.amount)),
      // Pre-format date on server
      formattedDate: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(tx.date)),
      // Build category path on server
      categoryPath: tx.category
        ? tx.category.name
        : 'Uncategorized',
    }));

    // Get the next cursor (last item's ID)
    const nextCursor = hasMore && formattedTransactions.length > 0
      ? formattedTransactions[formattedTransactions.length - 1]!.id
      : undefined;

    return {
      transactions: formattedTransactions,
      total: input.cursor ? undefined : total, // Only return total for offset pagination
      hasMore,
      nextCursor, // For cursor-based pagination
    };
  }),

  /**
   * Get single transaction by ID
   */
  byId: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.transaction.findUnique({
      where: { id: input, householdId: ctx.householdId },
      include: {
        category: true,
        account: true,
        template: true,
      },
    });
  }),

  /**
   * Create a new transaction
   */
  create: protectedProcedure.input(createTransactionSchema).mutation(async ({ ctx, input }) => {
    // Parallelize all initial database queries
    const [account, rulesRaw, categoriesRaw] = await Promise.all([
      // Validate account exists and belongs to household
      ctx.prisma.account.findFirst({
        where: { id: input.accountId, householdId: ctx.householdId },
      }),
      // Get rules for auto-categorization
      ctx.prisma.categoryRule.findMany({
        where: { householdId: ctx.householdId, isActive: true },
      }),
      // Get categories for AI categorization
      ctx.prisma.category.findMany({
        where: { householdId: ctx.householdId, isActive: true },
        select: { id: true, name: true, type: true },
      }),
    ]);

    if (!account) {
      throw new Error('Account not found or does not belong to your household');
    }

    // Map to domain types
    const rules = rulesRaw.map((r: typeof rulesRaw[number]) => ({
      ...r,
      type: r.type as 'merchant' | 'keyword' | 'regex',
    }));

    const categories = categoriesRaw.map((c: typeof categoriesRaw[number]) => ({
      ...c,
      type: c.type as 'income' | 'expected' | 'varying',
    }));

    // Auto-categorize if no category provided
    let categoryId: string | null | undefined = input.categoryId;
    let categorizationSource = 'manual';
    let confidence = 1;

    if (!categoryId) {
      const result = await categorizeTransaction(
        {
          description: input.description,
          merchant: input.merchant,
          amount: input.amount,
          direction: input.direction,
        },
        rules,
        categories,
        {
          enableAI: !!process.env.GEMINI_API_KEY,
          aiApiKey: process.env.GEMINI_API_KEY,
        }
      );

      // If categorization returned null (fallback), find a default category from the database
      if (result.categoryId === null && result.source === 'fallback') {
        // Find the first active category matching the direction
        const fallbackCategory = await ctx.prisma.category.findFirst({
          where: {
            householdId: ctx.householdId,
            isActive: true,
            type: input.direction === 'income' ? 'income' : 'varying',
          },
          orderBy: { sortOrder: 'asc' },
        });

        categoryId = fallbackCategory?.id ?? null;
      } else {
        categoryId = result.categoryId ?? null;
      }

      categorizationSource = result.source;
      confidence = result.confidence;

      // Auto-create rule from AI suggestion with high confidence (≥0.75)
      // This helps the system "learn" and reduces future AI calls
      if (result.source === 'ai_suggestion' && result.confidence >= 0.75 && categoryId) {
        const rulePattern = input.merchant || extractKeyword(input.description);
        const ruleType = input.merchant ? 'merchant' : 'keyword';

        if (rulePattern && rulePattern.length >= 3) {
          // Check if similar rule already exists
          const existingRule = await ctx.prisma.categoryRule.findFirst({
            where: {
              householdId: ctx.householdId,
              pattern: { contains: rulePattern, mode: 'insensitive' },
            },
          });

          if (!existingRule) {
            await ctx.prisma.categoryRule.create({
              data: {
                householdId: ctx.householdId,
                categoryId,
                type: ruleType,
                pattern: rulePattern,
                priority: 5, // Medium priority - can be overridden by user rules
                isActive: true,
                createdFrom: 'ai_suggestion',
              },
            });
          }
        }
      }
    }

    // Build transaction data - only include categoryId if it's not null
    const transactionData: any = {
      householdId: ctx.householdId,
      accountId: input.accountId,
      date: input.date,
      description: input.description,
      merchant: input.merchant,
      amount: input.amount,
      direction: input.direction,
      categorizationSource,
      confidence,
      notes: input.notes,
      needsReview: categorizationSource === 'fallback',
    };

    // Only set categoryId if it has a value
    if (categoryId) {
      transactionData.categoryId = categoryId;
    }

    return ctx.prisma.transaction.create({
      data: transactionData,
      include: {
        category: true,
        account: true,
      },
    });
  }),

  /**
   * Update a transaction (including recategorization)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: updateTransactionSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { ...input.data };

      // If category is being changed, mark as manual and clear review
      if (input.data.categoryId !== undefined) {
        updateData.categorizationSource = 'manual';
        updateData.confidence = 1;
        updateData.needsReview = false;
      }

      return ctx.prisma.transaction.update({
        where: { id: input.id, householdId: ctx.householdId },
        data: updateData,
        include: {
          category: true,
          account: true,
        },
      });
    }),

  /**
   * Delete a transaction
   */
  delete: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.transaction.delete({
      where: { id: input, householdId: ctx.householdId },
    });
  }),

  /**
   * Get transactions needing review
   */
  needsReview: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        needsReview: true,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true, type: true },
        },
        account: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }),

  /**
   * Apply categorization rules to all uncategorized or low-confidence transactions
   * Limited to 20 transactions per call to avoid timeouts
   * AI calls are rate-limited to respect Gemini's 15 req/min limit
   */
  applyCategorization: protectedProcedure
    .input(z.void())
    .mutation(async ({ ctx }) => {
    const MAX_TRANSACTIONS = 20; // Limit per call to avoid timeouts
    const AI_DELAY_MS = 4500; // ~13 requests/min to stay under 15 req/min limit

    // Get transactions that need categorization (limited)
    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        OR: [
          { categoryId: null },
          { needsReview: true },
          { confidence: { lt: 0.8 } },
        ],
      },
      take: MAX_TRANSACTIONS,
      orderBy: { date: 'desc' }, // Process most recent first
    });

    // Get total count for reporting
    const totalNeedingCategorization = await ctx.prisma.transaction.count({
      where: {
        householdId: ctx.householdId,
        OR: [
          { categoryId: null },
          { needsReview: true },
          { confidence: { lt: 0.8 } },
        ],
      },
    });

    if (transactions.length === 0) {
      return { updated: 0, message: 'No transactions need categorization' };
    }

    // Parallelize getting rules and categories
    const [rulesRaw, categoriesRaw] = await Promise.all([
      // Get active rules
      ctx.prisma.categoryRule.findMany({
        where: { householdId: ctx.householdId, isActive: true },
      }),
      // Get categories for AI categorization
      ctx.prisma.category.findMany({
        where: { householdId: ctx.householdId, isActive: true },
        select: { id: true, name: true, type: true },
      }),
    ]);

    const rules = rulesRaw.map((r: typeof rulesRaw[number]) => ({
      ...r,
      type: r.type as 'merchant' | 'keyword' | 'regex',
    }));

    const categories = categoriesRaw.map((c: typeof categoriesRaw[number]) => ({
      ...c,
      type: c.type as 'income' | 'expected' | 'varying',
    }));

    let updatedCount = 0;
    let aiCallCount = 0;

    // Helper to delay between AI calls
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // Apply rules to each transaction
    for (const tx of transactions) {
      // First try rule-based categorization (no AI, fast)
      const ruleResult = await categorizeTransaction(
        {
          description: tx.description,
          merchant: tx.merchant,
          amount: tx.amount,
          direction: tx.direction as 'income' | 'expense',
        },
        rules,
        categories,
        {
          enableAI: false, // First pass: rules only
        }
      );

      // If rules found a match, use it
      if (ruleResult.categoryId && ruleResult.source !== 'fallback') {
        const category = await ctx.prisma.category.findFirst({
          where: { id: ruleResult.categoryId, householdId: ctx.householdId },
        });
        if (category) {
          await ctx.prisma.transaction.update({
            where: { id: tx.id },
            data: {
              categoryId: ruleResult.categoryId,
              categorizationSource: ruleResult.source,
              confidence: ruleResult.confidence,
              needsReview: false,
            },
          });
          updatedCount++;
          continue;
        }
      }

      // No rule match - try AI if enabled (with rate limiting)
      if (process.env.GEMINI_API_KEY) {
        // Rate limit AI calls
        if (aiCallCount > 0) {
          await delay(AI_DELAY_MS);
        }
        aiCallCount++;

        const result = await categorizeTransaction(
          {
            description: tx.description,
            merchant: tx.merchant,
            amount: tx.amount,
            direction: tx.direction as 'income' | 'expense',
          },
          rules,
          categories,
          {
            enableAI: true,
            aiApiKey: process.env.GEMINI_API_KEY,
          }
        );

        // Determine categoryId (handle fallback case)
        let finalCategoryId = result.categoryId;

        if (result.categoryId === null && result.source === 'fallback') {
          // Find the first active category matching the direction
          const fallbackCategory = await ctx.prisma.category.findFirst({
            where: {
              householdId: ctx.householdId,
              isActive: true,
              type: tx.direction === 'income' ? 'income' : 'varying',
            },
            orderBy: { sortOrder: 'asc' },
          });
          finalCategoryId = fallbackCategory?.id ?? null;
        }

        // Only update if we got a category (not null)
        if (finalCategoryId) {
          // Validate category exists in household
          const category = await ctx.prisma.category.findFirst({
            where: {
              id: finalCategoryId,
              householdId: ctx.householdId,
            },
          });

          if (category) {
            await ctx.prisma.transaction.update({
              where: { id: tx.id },
              data: {
                categoryId: finalCategoryId,
                categorizationSource: result.source,
                confidence: result.confidence,
                needsReview: result.source === 'ai_suggestion', // AI suggestions should be reviewed
              },
            });
            updatedCount++;

            // Auto-create rule from AI suggestion with high confidence (≥0.75)
            if (result.source === 'ai_suggestion' && result.confidence >= 0.75) {
              const rulePattern = tx.merchant || extractKeyword(tx.description);
              const ruleType = tx.merchant ? 'merchant' : 'keyword';

              if (rulePattern && rulePattern.length >= 3) {
                // Check if similar rule already exists
                const existingRule = await ctx.prisma.categoryRule.findFirst({
                  where: {
                    householdId: ctx.householdId,
                    pattern: { contains: rulePattern, mode: 'insensitive' },
                  },
                });

                if (!existingRule) {
                  await ctx.prisma.categoryRule.create({
                    data: {
                      householdId: ctx.householdId,
                      categoryId: finalCategoryId,
                      type: ruleType,
                      pattern: rulePattern,
                      priority: 5,
                      isActive: true,
                      createdFrom: 'ai_suggestion',
                    },
                  });
                }
              }
            }
          }
        }
      }
    }

    const remaining = totalNeedingCategorization - updatedCount;
    const hasMore = remaining > 0;

    return {
      updated: updatedCount,
      remaining: hasMore ? remaining : 0,
      message: hasMore
        ? `Updated ${updatedCount} transaction(s). ${remaining} more need categorization - click again to continue.`
        : `Updated ${updatedCount} transaction(s) with categorization rules${process.env.GEMINI_API_KEY ? ' and AI suggestions' : ''}`,
    };
  }),

  /**
   * Recategorize a transaction and optionally create a rule
   */
  recategorize: protectedProcedure
    .input(
      z.object({
        transactionId: z.string(),
        categoryId: z.string(),
        createRule: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.prisma.transaction.findUnique({
        where: { id: input.transactionId, householdId: ctx.householdId },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update the transaction
      const updated = await ctx.prisma.transaction.update({
        where: { id: input.transactionId, householdId: ctx.householdId },
        data: {
          categoryId: input.categoryId,
          categorizationSource: 'manual',
          confidence: 1,
          needsReview: false,
        },
        include: { category: true },
      });

      // Optionally create a rule
      if (input.createRule && transaction.merchant) {
        await ctx.prisma.categoryRule.create({
          data: {
            householdId: ctx.householdId,
            categoryId: input.categoryId,
            type: 'merchant',
            pattern: transaction.merchant,
            priority: 10,
            createdFrom: 'correction',
          },
        });
      }

      return updated;
    }),

  /**
   * Toggle the ignored status of a transaction
   */
  toggleIgnore: protectedProcedure
    .input(
      z.object({
        transactionId: z.string(),
        isIgnored: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.transaction.update({
        where: { id: input.transactionId, householdId: ctx.householdId },
        data: {
          isIgnored: input.isIgnored,
        },
        include: {
          category: true,
          account: true,
        },
      });
    }),

  /**
   * Batch approve - mark multiple transactions as reviewed (needsReview = false)
   */
  batchApprove: protectedProcedure
    .input(z.object({ transactionIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.transaction.updateMany({
        where: {
          id: { in: input.transactionIds },
          householdId: ctx.householdId,
        },
        data: {
          needsReview: false,
        },
      });
      return { updated: result.count };
    }),

  /**
   * Batch ignore - mark multiple transactions as ignored
   */
  batchIgnore: protectedProcedure
    .input(
      z.object({
        transactionIds: z.array(z.string()).min(1),
        isIgnored: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.transaction.updateMany({
        where: {
          id: { in: input.transactionIds },
          householdId: ctx.householdId,
        },
        data: {
          isIgnored: input.isIgnored,
        },
      });
      return { updated: result.count };
    }),

  /**
   * Batch delete - delete multiple transactions
   */
  batchDelete: protectedProcedure
    .input(z.object({ transactionIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.transaction.deleteMany({
        where: {
          id: { in: input.transactionIds },
          householdId: ctx.householdId,
        },
      });
      return { deleted: result.count };
    }),

  /**
   * Batch recategorize - apply a category to multiple transactions
   */
  batchRecategorize: protectedProcedure
    .input(
      z.object({
        transactionIds: z.array(z.string()).min(1),
        categoryId: z.string(),
        createRule: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // If createRule is requested, get the first transaction to extract merchant pattern
      if (input.createRule) {
        const firstTransaction = await ctx.prisma.transaction.findFirst({
          where: {
            id: { in: input.transactionIds },
            householdId: ctx.householdId,
            merchant: { not: null },
          },
        });

        if (firstTransaction?.merchant) {
          // Check if rule already exists
          const existingRule = await ctx.prisma.categoryRule.findFirst({
            where: {
              householdId: ctx.householdId,
              pattern: { contains: firstTransaction.merchant, mode: 'insensitive' },
            },
          });

          if (!existingRule) {
            await ctx.prisma.categoryRule.create({
              data: {
                householdId: ctx.householdId,
                categoryId: input.categoryId,
                type: 'merchant',
                pattern: firstTransaction.merchant,
                priority: 10,
                createdFrom: 'correction',
              },
            });
          }
        }
      }

      const result = await ctx.prisma.transaction.updateMany({
        where: {
          id: { in: input.transactionIds },
          householdId: ctx.householdId,
        },
        data: {
          categoryId: input.categoryId,
          categorizationSource: 'manual',
          confidence: 1,
          needsReview: false,
        },
      });

      return { updated: result.count };
    }),

  /**
   * Get monthly summary (totals) for a date range
   * Calculates income, expenses, and net from ALL transactions in the database
   */
  monthlySummary: protectedProcedure
    .input(
      z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        includeIgnored: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        householdId: ctx.householdId,
        date: {
          gte: input.startDate,
          lte: input.endDate,
        },
      };

      // Filter out ignored transactions by default
      if (!input.includeIgnored) {
        where.isIgnored = false;
      }

      // Get all transactions for the period (only the fields we need for aggregation)
      const transactions = await ctx.prisma.transaction.findMany({
        where,
        select: {
          amount: true,
          direction: true,
        },
      });

      // Calculate totals
      const totalIncome = transactions
        .filter((t) => t.direction === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = transactions
        .filter((t) => t.direction === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const netBalance = totalIncome - totalExpenses;

      return {
        totalIncome,
        totalExpenses,
        netBalance,
        transactionCount: transactions.length,
      };
    }),
});

