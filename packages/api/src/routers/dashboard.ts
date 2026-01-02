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
  isIgnored: boolean;
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
   * Get full dashboard data in a single request (consolidated for performance)
   */
  getFullDashboard: protectedProcedure
    .input(z.object({
      month: monthSchema,
      recentLimit: z.number().default(5),
    }))
    .query(async ({ ctx, input }) => {
      const [year, monthNum] = input.month.split('-').map(Number);
      const startDate = new Date(year!, monthNum! - 1, 1);
      const endDate = new Date(year!, monthNum!, 0, 23, 59, 59, 999);

      // Run all dashboard queries in parallel for maximum performance
      const [
        transactions,
        budgets,
        varyingCategory,
        needsReviewCount,
        categories,
        recentTransactions,
      ] = await Promise.all([
        // Transactions for the month
        ctx.prisma.transaction.findMany({
          where: {
            householdId: ctx.householdId,
            isIgnored: false,
            date: { gte: startDate, lte: endDate },
          },
          include: {
            category: {
              select: { id: true, name: true, icon: true, color: true, type: true },
            },
          },
        }),
        // Budgets for the month
        ctx.prisma.budget.findMany({
          where: { householdId: ctx.householdId, month: input.month },
          include: { category: true },
        }),
        // Varying category
        ctx.prisma.category.findFirst({
          where: { householdId: ctx.householdId, type: 'varying' },
        }),
        // Needs review count
        ctx.prisma.transaction.count({
          where: {
            householdId: ctx.householdId,
            needsReview: true,
            isIgnored: false,
          },
        }),
        // Categories with budgets for breakdown
        ctx.prisma.category.findMany({
          where: {
            householdId: ctx.householdId,
            isActive: true,
            type: { in: ['expected', 'varying'] },
          },
          include: {
            budgets: { where: { month: input.month } },
          },
        }),
        // Recent transactions
        ctx.prisma.transaction.findMany({
          where: {
            householdId: ctx.householdId,
            isIgnored: false,
            date: { gte: startDate, lte: endDate },
          },
          include: {
            category: {
              select: { id: true, name: true, icon: true, color: true, type: true },
            },
            account: {
              select: { id: true, name: true, icon: true },
            },
          },
          orderBy: { date: 'desc' },
          take: input.recentLimit,
        }),
      ]);

      // Calculate KPIs
      const domainTransactions = toTransactions(transactions);
      const kpis = calculateMonthlyKPIs(domainTransactions, input.month);

      // Calculate budget evaluations
      const budgetEvaluations = budgets.map((budget) => {
        const actualAmount = calculateCategorySpending(
          domainTransactions,
          budget.categoryId,
          input.month
        );
        return {
          ...evaluateBudgetStatus(toBudget(budget), actualAmount),
          category: budget.category,
        };
      });

      // Get alerts
      const alerts = getAlertBudgets(budgetEvaluations);

      // Get varying expenses
      const varyingExpenses = transactions.filter(
        (t) =>
          t.direction === 'expense' &&
          (t.categoryId === varyingCategory?.id || t.categoryId === null)
      );

      // Calculate category breakdown
      const categoryBreakdown = categories.map((category) => {
        const categoryTransactions = transactions.filter((t) => t.categoryId === category.id && t.direction === 'expense');
        const actualAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
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

      // Format KPIs on server
      const formattedKpis = {
        ...kpis,
        formattedIncome: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(kpis.totalIncome),
        formattedExpenses: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(kpis.totalExpenses),
        formattedSavings: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(kpis.netSavings),
        formattedSavingsRate: new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(kpis.savingsRate),
      };

      // Format recent transactions on server
      const formattedRecentTransactions = recentTransactions.map(tx => ({
        ...tx,
        formattedAmount: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(Math.abs(tx.amount)),
        formattedDate: new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
        }).format(new Date(tx.date)),
      }));

      return {
        month: input.month,
        overview: {
          kpis: formattedKpis,
          budgetSummary: {
            total: budgetEvaluations.length,
            onTrack: budgetEvaluations.filter((e) => e.status === 'ok').length,
            nearingLimit: budgetEvaluations.filter((e) => e.status === 'nearing_limit').length,
            exceededSoft: budgetEvaluations.filter((e) => e.status === 'exceeded_soft').length,
            exceededHard: budgetEvaluations.filter((e) => e.status === 'exceeded_hard').length,
          },
          alerts: alerts.map((a) => ({
            categoryId: a.budget.categoryId,
            categoryName: budgets.find((b) => b.categoryId === a.budget.categoryId)?.category.name,
            status: a.status,
            percentUsed: a.percentUsed,
            actualAmount: a.actualAmount,
            plannedAmount: a.budget.plannedAmount,
            limitAmount: a.budget.limitAmount,
            // Format on server
            formattedActual: new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(a.actualAmount),
            formattedPlanned: new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(a.budget.plannedAmount),
          })),
          varyingExpenses: {
            count: varyingExpenses.length,
            total: varyingExpenses.reduce((sum, t) => sum + t.amount, 0),
            formattedTotal: new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(varyingExpenses.reduce((sum, t) => sum + t.amount, 0)),
          },
          needsReviewCount,
        },
        categoryBreakdown,
        recentTransactions: formattedRecentTransactions,
      };
    }),

  /**
   * Get dashboard overview for a month
   */
  overview: protectedProcedure.input(monthSchema).query(async ({ ctx, input }) => {
    const [year, monthNum] = input.split('-').map(Number);
    const startDate = new Date(year!, monthNum! - 1, 1);
    const endDate = new Date(year!, monthNum!, 0, 23, 59, 59, 999);

    // Parallelize all independent database queries
    const [transactions, budgets, varyingCategory, needsReviewCount] = await Promise.all([
      // Get all transactions for the month (excluding ignored)
      ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
          isIgnored: false,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          category: {
            select: { id: true, name: true, icon: true, color: true, type: true },
          },
        },
      }),
      // Get budgets with evaluations
      ctx.prisma.budget.findMany({
        where: {
          householdId: ctx.householdId,
          month: input,
        },
        include: {
          category: true,
        },
      }),
      // Get varying category
      ctx.prisma.category.findFirst({
        where: {
          householdId: ctx.householdId,
          type: 'varying',
        },
      }),
      // Get transactions needing review count
      ctx.prisma.transaction.count({
        where: {
          householdId: ctx.householdId,
          needsReview: true,
          isIgnored: false,
        },
      }),
    ]);

    // Calculate KPIs
    const domainTransactions = toTransactions(transactions);
    const kpis = calculateMonthlyKPIs(domainTransactions, input);

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
    const varyingExpenses = transactions.filter(
      (t: typeof transactions[number]) =>
        t.direction === 'expense' &&
        (t.categoryId === varyingCategory?.id || t.categoryId === null)
    );

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
    const endDate = new Date(year!, monthNum!, 0, 23, 59, 59, 999);

    // Parallelize independent queries
    const [categories, transactions] = await Promise.all([
      // Get categories with their budgets
      ctx.prisma.category.findMany({
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
      }),
      // Get transactions for the month
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
    const endDate = new Date(year!, monthNum!, 0, 23, 59, 59, 999);

    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        isIgnored: false,
        date: {
          gte: startDate,
          lte: endDate,
        },
        direction: 'income',
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
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
   * Get recent transactions for a month
   */
  recentTransactions: protectedProcedure
    .input(z.object({ 
      limit: z.number().default(10),
      month: monthSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        householdId: ctx.householdId,
        isIgnored: false,
      };

      if (input.month) {
        const [year, monthNum] = input.month.split('-').map(Number);
        const startDate = new Date(year!, monthNum! - 1, 1);
        const endDate = new Date(year!, monthNum!, 0, 23, 59, 59, 999);
        where.date = {
          gte: startDate,
          lte: endDate,
        };
      }

      return ctx.prisma.transaction.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, icon: true, color: true, type: true },
          },
          account: {
            select: { id: true, name: true, icon: true },
          },
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

