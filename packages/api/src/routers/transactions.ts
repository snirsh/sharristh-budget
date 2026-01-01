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
        { description: { contains: input.search } },
        { merchant: { contains: input.search } },
      ];
    }

    const [transactions, total] = await Promise.all([
      ctx.prisma.transaction.findMany({
        where,
        include: {
          category: true,
          account: true,
        },
        orderBy: { date: 'desc' },
        take: input.limit,
        skip: input.offset,
      }),
      ctx.prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      hasMore: input.offset + transactions.length < total,
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
    // Validate account exists and belongs to household
    const account = await ctx.prisma.account.findFirst({
      where: { id: input.accountId, householdId: ctx.householdId },
    });

    if (!account) {
      throw new Error('Account not found or does not belong to your household');
    }

    // Get rules for auto-categorization
    const rulesRaw = await ctx.prisma.categoryRule.findMany({
      where: { householdId: ctx.householdId, isActive: true },
    });

    // Map to domain types
    const rules = rulesRaw.map((r: typeof rulesRaw[number]) => ({
      ...r,
      type: r.type as 'merchant' | 'keyword' | 'regex',
    }));

    // Get categories for AI categorization
    const categoriesRaw = await ctx.prisma.category.findMany({
      where: { householdId: ctx.householdId, isActive: true },
      select: { id: true, name: true, type: true },
    });

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
        category: true,
        account: true,
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }),

  /**
   * Apply categorization rules to all uncategorized or low-confidence transactions
   */
  applyCategorization: protectedProcedure.mutation(async ({ ctx }) => {
    // Get all transactions that need categorization
    const transactions = await ctx.prisma.transaction.findMany({
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

    // Get active rules
    const rulesRaw = await ctx.prisma.categoryRule.findMany({
      where: { householdId: ctx.householdId, isActive: true },
    });
    const rules = rulesRaw.map((r: typeof rulesRaw[number]) => ({
      ...r,
      type: r.type as 'merchant' | 'keyword' | 'regex',
    }));

    // Get categories for AI categorization
    const categoriesRaw = await ctx.prisma.category.findMany({
      where: { householdId: ctx.householdId, isActive: true },
      select: { id: true, name: true, type: true },
    });

    const categories = categoriesRaw.map((c: typeof categoriesRaw[number]) => ({
      ...c,
      type: c.type as 'income' | 'expected' | 'varying',
    }));

    let updatedCount = 0;

    // Apply rules to each transaction
    for (const tx of transactions) {
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
          enableAI: !!process.env.GEMINI_API_KEY,
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

    return {
      updated: updatedCount,
      message: `Updated ${updatedCount} transaction(s) with categorization rules${process.env.GEMINI_API_KEY ? ' and AI suggestions' : ''}`,
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
        where: { id: input.transactionId },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update the transaction
      const updated = await ctx.prisma.transaction.update({
        where: { id: input.transactionId },
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
});

