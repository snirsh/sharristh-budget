import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { monthSchema } from '@sfam/domain/schemas';
import {
  calculateMonthlyKPIs,
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
function toTransactions<T extends {
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
  isRecurringInstance: boolean;
  recurringTemplateId?: string | null;
  recurringInstanceKey?: string | null;
}>(txs: T[]): Transaction[] {
  return txs.map(t => ({
    ...t,
    direction: t.direction as 'income' | 'expense' | 'transfer',
    date: new Date(t.date),
  }));
}

export const dashboardRouter = router({
  /**
   * Get dashboard overview for a month
   */
  overview: protectedProcedure.input(monthSchema).query(async ({ ctx, input }) => {
    const [year, monthNum] = input.split('-').map(Number);
    const startDate = new Date(year!, monthNum! - 1, 1);
    const endDate = new Date(year!, monthNum!, 0);

    // Get all transactions for the month
    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        category: true,
      },
    });

    // Calculate KPIs
    const domainTransactions = toTransactions(transactions);
    const kpis = calculateMonthlyKPIs(domainTransactions, input);

    // Get budgets with evaluations
    const budgets = await ctx.prisma.budget.findMany({
      where: {
        householdId: ctx.householdId,
        month: input,
      },
      include: {
        category: true,
      },
    });

    const budgetEvaluations = budgets.map((budget: typeof budgets[number]) => {
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

    // Get alerts
    const alerts = getAlertBudgets(budgetEvaluations);

    // Get varying expenses (uncategorized or varying category)
    const varyingCategory = await ctx.prisma.category.findFirst({
      where: {
        householdId: ctx.householdId,
        type: 'varying',
      },
    });

    const varyingExpenses = transactions.filter(
      (t: typeof transactions[number]) =>
        t.direction === 'expense' &&
        (t.categoryId === varyingCategory?.id || t.categoryId === null)
    );

    // Get transactions needing review
    const needsReviewCount = await ctx.prisma.transaction.count({
      where: {
        householdId: ctx.householdId,
        needsReview: true,
      },
    });

    return {
      month: input,
      kpis,
      budgetSummary: {
        total: budgetEvaluations.length,
        onTrack: budgetEvaluations.filter((e: typeof budgetEvaluations[number]) => e.status === 'ok').length,
        nearingLimit: budgetEvaluations.filter((e: typeof budgetEvaluations[number]) => e.status === 'nearing_limit').length,
        exceededSoft: budgetEvaluations.filter((e: typeof budgetEvaluations[number]) => e.status === 'exceeded_soft').length,
        exceededHard: budgetEvaluations.filter((e: typeof budgetEvaluations[number]) => e.status === 'exceeded_hard').length,
      },
      alerts: alerts.map((a) => ({
        categoryId: a.budget.categoryId,
        categoryName: budgets.find((b: typeof budgets[number]) => b.categoryId === a.budget.categoryId)?.category.name,
        status: a.status,
        percentUsed: a.percentUsed,
        actualAmount: a.actualAmount,
        plannedAmount: a.budget.plannedAmount,
        limitAmount: a.budget.limitAmount,
      })),
      varyingExpenses: {
        count: varyingExpenses.length,
        total: varyingExpenses.reduce((sum: number, t: typeof varyingExpenses[number]) => sum + t.amount, 0),
      },
      needsReviewCount,
    };
  }),

  /**
   * Get category breakdown for a month
   */
  categoryBreakdown: protectedProcedure.input(monthSchema).query(async ({ ctx, input }) => {
    const [year, monthNum] = input.split('-').map(Number);
    const startDate = new Date(year!, monthNum! - 1, 1);
    const endDate = new Date(year!, monthNum!, 0);

    // Get categories with their transactions
    const categories = await ctx.prisma.category.findMany({
      where: {
        householdId: ctx.householdId,
        isActive: true,
        type: { in: ['expected', 'varying'] },
      },
      include: {
        budgets: {
          where: { month: input },
        },
      },
    });

    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        direction: 'expense',
      },
    });

    return categories.map((category: typeof categories[number]) => {
      const categoryTransactions = transactions.filter((t: typeof transactions[number]) => t.categoryId === category.id);
      const actualAmount = categoryTransactions.reduce((sum: number, t: typeof categoryTransactions[number]) => sum + t.amount, 0);
      const budget = category.budgets[0];

      let status = 'ok';
      let percentUsed = 0;

      if (budget) {
        const evaluation = evaluateBudgetStatus(toBudget(budget), actualAmount);
        status = evaluation.status;
        percentUsed = evaluation.percentUsed;
      } else if (actualAmount > 0) {
        status = 'no_budget';
      }

      return {
        category: {
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
          type: category.type,
        },
        plannedAmount: budget?.plannedAmount ?? 0,
        limitAmount: budget?.limitAmount ?? null,
        actualAmount,
        percentUsed,
        status,
        transactionCount: categoryTransactions.length,
      };
    });
  }),

  /**
   * Get income breakdown for a month
   */
  incomeBreakdown: protectedProcedure.input(monthSchema).query(async ({ ctx, input }) => {
    const [year, monthNum] = input.split('-').map(Number);
    const startDate = new Date(year!, monthNum! - 1, 1);
    const endDate = new Date(year!, monthNum!, 0);

    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        direction: 'income',
      },
      include: {
        category: true,
      },
    });

    // Group by category
    const byCategory = new Map<
      string,
      {
        category: { id: string; name: string; icon: string | null; color: string | null };
        total: number;
        count: number;
      }
    >();

    for (const tx of transactions) {
      const categoryId = tx.categoryId ?? 'uncategorized';
      const existing = byCategory.get(categoryId);

      if (existing) {
        existing.total += tx.amount;
        existing.count += 1;
      } else {
        byCategory.set(categoryId, {
          category: tx.category ?? {
            id: 'uncategorized',
            name: 'Uncategorized',
            icon: null,
            color: null,
          },
          total: tx.amount,
          count: 1,
        });
      }
    }

    return Array.from(byCategory.values()).sort((a, b) => b.total - a.total);
  }),

  /**
   * Get recent transactions
   */
  recentTransactions: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
        },
        include: {
          category: true,
          account: true,
        },
        orderBy: { date: 'desc' },
        take: input.limit,
      });
    }),

  /**
   * Get accounts summary
   */
  accountsSummary: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.prisma.account.findMany({
      where: {
        householdId: ctx.householdId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    const totalBalance = accounts.reduce((sum: number, a: typeof accounts[number]) => sum + a.balance, 0);

    return {
      accounts,
      totalBalance,
    };
  }),
});

