import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  createBudgetSchema,
  updateBudgetSchema,
  monthSchema,
} from '@sfam/domain/schemas';
import {
  evaluateBudgetStatus,
  calculateCategorySpending,
  getAlertBudgets,
  type Budget,
  type Transaction,
} from '@sfam/domain';

// Helper to map Prisma budget to domain type
function toBudget(b: {
  id: string;
  householdId: string;
  categoryId: string;
  month: string;
  plannedAmount: number;
  limitAmount?: number | null;
  limitType?: string | null;
  alertThresholdPct: number;
}): Budget {
  return {
    ...b,
    limitType: b.limitType as 'soft' | 'hard' | null | undefined,
  };
}

// Helper to map Prisma transactions to domain type
function toTransactions(txs: Array<{
  id: string;
  householdId: string;
  accountId: string;
  userId?: string | null;
  categoryId?: string | null;
  date: Date;
  description: string;
  merchant?: string | null;
  amount: number;
  direction: string;
  needsReview: boolean;
  isIgnored: boolean;
  isRecurringInstance: boolean;
  recurringTemplateId?: string | null;
  recurringInstanceKey?: string | null;
}>): Transaction[] {
  return txs.map(t => ({
    ...t,
    direction: t.direction as 'income' | 'expense' | 'transfer',
    date: new Date(t.date),
  }));
}

export const budgetsRouter = router({
  /**
   * Get budgets for a month with evaluations
   */
  forMonth: protectedProcedure.input(monthSchema).query(async ({ ctx, input }) => {
    // Calculate date range
    const [year, monthNum] = input.split('-').map(Number);
    const startDate = new Date(year!, monthNum! - 1, 1);
    const endDate = new Date(year!, monthNum!, 0, 23, 59, 59, 999);

    // Parallelize independent database queries
    const [budgets, transactions] = await Promise.all([
      ctx.prisma.budget.findMany({
        where: {
          householdId: ctx.householdId,
          month: input,
        },
        include: {
          category: true,
        },
      }),
      ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
          isIgnored: false,
          date: {
            gte: startDate,
            lte: endDate,
          },
          direction: 'expense',
        },
      }),
    ]);

    // Evaluate each budget
    const domainTransactions = toTransactions(transactions);
    const evaluations = budgets.map((budget: typeof budgets[number]) => {
      const actualAmount = calculateCategorySpending(
        domainTransactions,
        budget.categoryId,
        input
      );

      return {
        ...evaluateBudgetStatus(toBudget(budget), actualAmount),
        category: budget.category,
      };
    });

    return evaluations;
  }),

  /**
   * Get alert budgets (nearing or exceeding limits)
   */
  alerts: protectedProcedure.input(monthSchema).query(async ({ ctx, input }) => {
    // Calculate date range
    const [year, monthNum] = input.split('-').map(Number);
    const startDate = new Date(year!, monthNum! - 1, 1);
    const endDate = new Date(year!, monthNum!, 0, 23, 59, 59, 999);

    // Parallelize independent database queries
    const [budgets, transactions] = await Promise.all([
      ctx.prisma.budget.findMany({
        where: {
          householdId: ctx.householdId,
          month: input,
        },
        include: {
          category: true,
        },
      }),
      ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
          isIgnored: false,
          date: {
            gte: startDate,
            lte: endDate,
          },
          direction: 'expense',
        },
      }),
    ]);

    const domainTransactions = toTransactions(transactions);
    const evaluations = budgets.map((budget: typeof budgets[number]) => {
      const actualAmount = calculateCategorySpending(
        domainTransactions,
        budget.categoryId,
        input
      );

      return {
        ...evaluateBudgetStatus(toBudget(budget), actualAmount),
        category: budget.category,
      };
    });

    return getAlertBudgets(evaluations).map((e) => ({
      ...e,
      category: budgets.find((b: typeof budgets[number]) => b.categoryId === e.budget.categoryId)?.category,
    }));
  }),

  /**
   * Get or create budget for a category/month
   */
  byCategory: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        month: monthSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.budget.findUnique({
        where: {
          householdId_categoryId_month: {
            householdId: ctx.householdId,
            categoryId: input.categoryId,
            month: input.month,
          },
        },
        include: {
          category: true,
        },
      });
    }),

  /**
   * Create or update a budget (upsert)
   */
  upsert: protectedProcedure.input(createBudgetSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.budget.upsert({
      where: {
        householdId_categoryId_month: {
          householdId: ctx.householdId,
          categoryId: input.categoryId,
          month: input.month,
        },
      },
      create: {
        householdId: ctx.householdId,
        categoryId: input.categoryId,
        month: input.month,
        plannedAmount: input.plannedAmount,
        limitAmount: input.limitAmount,
        limitType: input.limitType,
        alertThresholdPct: input.alertThresholdPct ?? 0.8,
      },
      update: {
        plannedAmount: input.plannedAmount,
        limitAmount: input.limitAmount,
        limitType: input.limitType,
        alertThresholdPct: input.alertThresholdPct,
      },
      include: {
        category: true,
      },
    });
  }),

  /**
   * Update a budget
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: updateBudgetSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.budget.update({
        where: { id: input.id },
        data: input.data,
        include: {
          category: true,
        },
      });
    }),

  /**
   * Copy budgets from one month to another
   */
  copyMonth: protectedProcedure
    .input(
      z.object({
        fromMonth: monthSchema,
        toMonth: monthSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sourceBudgets = await ctx.prisma.budget.findMany({
        where: {
          householdId: ctx.householdId,
          month: input.fromMonth,
        },
      });

      // Create budgets for target month (skip if already exists)
      const created = await Promise.all(
        sourceBudgets.map((budget: typeof sourceBudgets[number]) =>
          ctx.prisma.budget.upsert({
            where: {
              householdId_categoryId_month: {
                householdId: ctx.householdId,
                categoryId: budget.categoryId,
                month: input.toMonth,
              },
            },
            create: {
              householdId: ctx.householdId,
              categoryId: budget.categoryId,
              month: input.toMonth,
              plannedAmount: budget.plannedAmount,
              limitAmount: budget.limitAmount,
              limitType: budget.limitType,
              alertThresholdPct: budget.alertThresholdPct,
            },
            update: {}, // Don't overwrite existing
          })
        )
      );

      return { count: created.length };
    }),

  /**
   * Delete a budget
   */
  delete: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.budget.delete({
      where: { id: input },
    });
  }),
});

