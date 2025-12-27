import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionFiltersSchema,
} from '@sharristh/domain/schemas';
import { categorizeTransaction } from '@sharristh/domain';

export const transactionsRouter = router({
  /**
   * List transactions with filters
   */
  list: publicProcedure.input(transactionFiltersSchema).query(async ({ ctx, input }) => {
    const where: Record<string, unknown> = {
      householdId: ctx.householdId,
    };

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
  byId: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
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
  create: publicProcedure.input(createTransactionSchema).mutation(async ({ ctx, input }) => {
    // Get rules for auto-categorization
    const rulesRaw = await ctx.prisma.categoryRule.findMany({
      where: { householdId: ctx.householdId, isActive: true },
    });

    // Map to domain types
    const rules = rulesRaw.map((r) => ({
      ...r,
      type: r.type as 'merchant' | 'keyword' | 'regex',
    }));

    // Auto-categorize if no category provided
    let categoryId = input.categoryId;
    let categorizationSource = 'manual';
    let confidence = 1;

    if (!categoryId) {
      const result = categorizeTransaction(
        {
          description: input.description,
          merchant: input.merchant,
          amount: input.amount,
          direction: input.direction,
        },
        rules
      );
      categoryId = result.categoryId ?? undefined;
      categorizationSource = result.source;
      confidence = result.confidence;
    }

    return ctx.prisma.transaction.create({
      data: {
        householdId: ctx.householdId,
        accountId: input.accountId,
        date: input.date,
        description: input.description,
        merchant: input.merchant,
        amount: input.amount,
        direction: input.direction,
        categoryId,
        categorizationSource,
        confidence,
        notes: input.notes,
        needsReview: categorizationSource === 'fallback',
      },
      include: {
        category: true,
        account: true,
      },
    });
  }),

  /**
   * Update a transaction (including recategorization)
   */
  update: publicProcedure
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
  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.transaction.delete({
      where: { id: input, householdId: ctx.householdId },
    });
  }),

  /**
   * Get transactions needing review
   */
  needsReview: publicProcedure.query(async ({ ctx }) => {
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
   * Recategorize a transaction and optionally create a rule
   */
  recategorize: publicProcedure
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
});

