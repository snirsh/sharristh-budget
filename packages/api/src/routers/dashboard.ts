import {
  type Budget,
  type Transaction,
  calculateCategorySpending,
  calculateMonthlyKPIs,
  evaluateBudgetStatus,
  getAlertBudgets,
} from '@sfam/domain';
import { monthSchema } from '@sfam/domain/schemas';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

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
function toTransactions<
  T extends {
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
  },
>(txs: T[]): Transaction[] {
  return txs.map((t) => ({
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
    .input(
      z.object({
        month: monthSchema,
        recentLimit: z.number().default(5),
      })
    )
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
        // Expense category (for uncategorized expenses)
        ctx.prisma.category.findFirst({
          where: { householdId: ctx.householdId, type: 'expense' },
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
            type: 'expense',
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
              select: { id: true, name: true },
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
        const categoryTransactions = transactions.filter(
          (t) => t.categoryId === category.id && t.direction === 'expense'
        );
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
      const formattedRecentTransactions = recentTransactions.map((tx) => ({
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
      // Get expense category (for uncategorized expenses)
      ctx.prisma.category.findFirst({
        where: {
          householdId: ctx.householdId,
          type: 'expense',
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

    const budgetEvaluations = budgets.map((budget: (typeof budgets)[number]) => {
      const actualAmount = calculateCategorySpending(domainTransactions, budget.categoryId, input);

      return {
        ...evaluateBudgetStatus(toBudget(budget), actualAmount),
        category: budget.category,
      };
    });

    // Get alerts
    const alerts = getAlertBudgets(budgetEvaluations);

    // Get varying expenses (uncategorized or varying category)
    const varyingExpenses = transactions.filter(
      (t: (typeof transactions)[number]) =>
        t.direction === 'expense' && (t.categoryId === varyingCategory?.id || t.categoryId === null)
    );

    return {
      month: input,
      kpis,
      budgetSummary: {
        total: budgetEvaluations.length,
        onTrack: budgetEvaluations.filter(
          (e: (typeof budgetEvaluations)[number]) => e.status === 'ok'
        ).length,
        nearingLimit: budgetEvaluations.filter(
          (e: (typeof budgetEvaluations)[number]) => e.status === 'nearing_limit'
        ).length,
        exceededSoft: budgetEvaluations.filter(
          (e: (typeof budgetEvaluations)[number]) => e.status === 'exceeded_soft'
        ).length,
        exceededHard: budgetEvaluations.filter(
          (e: (typeof budgetEvaluations)[number]) => e.status === 'exceeded_hard'
        ).length,
      },
      alerts: alerts.map((a) => ({
        categoryId: a.budget.categoryId,
        categoryName: budgets.find(
          (b: (typeof budgets)[number]) => b.categoryId === a.budget.categoryId
        )?.category.name,
        status: a.status,
        percentUsed: a.percentUsed,
        actualAmount: a.actualAmount,
        plannedAmount: a.budget.plannedAmount,
        limitAmount: a.budget.limitAmount,
      })),
      varyingExpenses: {
        count: varyingExpenses.length,
        total: varyingExpenses.reduce(
          (sum: number, t: (typeof varyingExpenses)[number]) => sum + t.amount,
          0
        ),
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
          type: 'expense',
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

    return categories.map((category: (typeof categories)[number]) => {
      const categoryTransactions = transactions.filter(
        (t: (typeof transactions)[number]) => t.categoryId === category.id
      );
      const actualAmount = categoryTransactions.reduce(
        (sum: number, t: (typeof categoryTransactions)[number]) => sum + t.amount,
        0
      );
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
    .input(
      z.object({
        limit: z.number().default(10),
        month: monthSchema.optional(),
      })
    )
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
            select: { id: true, name: true },
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

    const totalBalance = accounts.reduce(
      (sum: number, a: (typeof accounts)[number]) => sum + a.balance,
      0
    );

    return {
      accounts,
      totalBalance,
    };
  }),

  /**
   * Get expense insights for a month (credit card, expected, recurring, comparison, top merchants, largest transactions, last sync)
   */
  getExpenseInsights: protectedProcedure
    .input(z.object({ month: monthSchema }))
    .query(async ({ ctx, input }) => {
      const [year, monthNum] = input.month.split('-').map(Number);
      const startDate = new Date(year!, monthNum! - 1, 1);
      const endDate = new Date(year!, monthNum!, 0, 23, 59, 59, 999);

      // Calculate previous month dates
      const prevMonthDate = new Date(year!, monthNum! - 2, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = prevMonthDate.getMonth() + 1;
      const prevStartDate = new Date(prevYear, prevMonth - 1, 1);
      const prevEndDate = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

      // Run all queries in parallel for maximum performance
      const [
        creditCardAccounts,
        currentMonthTransactions,
        previousMonthTransactions,
        budgets,
        recurringTemplates,
        lastSyncConnection,
        transactionsWithAccounts,
      ] = await Promise.all([
        // Get credit card accounts
        ctx.prisma.account.findMany({
          where: {
            householdId: ctx.householdId,
            type: 'credit',
            isActive: true,
          },
          select: { id: true },
        }),
        // Current month expense transactions
        ctx.prisma.transaction.findMany({
          where: {
            householdId: ctx.householdId,
            isIgnored: false,
            direction: 'expense',
            date: { gte: startDate, lte: endDate },
          },
          include: {
            category: {
              select: { id: true, name: true, icon: true },
            },
            account: {
              select: { id: true, name: true, type: true },
            },
          },
        }),
        // Previous month expense transactions (for comparison)
        ctx.prisma.transaction.findMany({
          where: {
            householdId: ctx.householdId,
            isIgnored: false,
            direction: 'expense',
            date: { gte: prevStartDate, lte: prevEndDate },
          },
          select: { amount: true },
        }),
        // Budgets for expected expenses
        ctx.prisma.budget.findMany({
          where: {
            householdId: ctx.householdId,
            month: input.month,
          },
          select: { plannedAmount: true },
        }),
        // Active recurring expense templates
        ctx.prisma.recurringTransactionTemplate.findMany({
          where: {
            householdId: ctx.householdId,
            isActive: true,
            direction: 'expense',
          },
          select: { amount: true, name: true },
        }),
        // Most recent bank sync
        ctx.prisma.bankConnection.findFirst({
          where: {
            householdId: ctx.householdId,
            isActive: true,
            lastSyncAt: { not: null },
          },
          orderBy: { lastSyncAt: 'desc' },
          select: { lastSyncAt: true, lastSyncStatus: true },
        }),
        // Transactions with account info for credit card filtering
        ctx.prisma.transaction.findMany({
          where: {
            householdId: ctx.householdId,
            isIgnored: false,
            direction: 'expense',
            date: { gte: startDate, lte: endDate },
          },
          include: {
            account: {
              select: { id: true, type: true },
            },
          },
        }),
      ]);

      // Calculate credit card expenses total
      const creditCardAccountIds = new Set(creditCardAccounts.map((a) => a.id));
      const creditCardTotal = transactionsWithAccounts
        .filter((t) => creditCardAccountIds.has(t.accountId))
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate expected expenses (sum of all budgeted amounts)
      const expectedExpenses = budgets.reduce((sum, b) => sum + b.plannedAmount, 0);

      // Calculate recurring expenses total
      const recurringTotal = recurringTemplates.reduce((sum, t) => sum + t.amount, 0);

      // Calculate month comparison
      const currentMonthTotal = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
      const previousMonthTotal = previousMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
      const percentChange =
        previousMonthTotal > 0 ? (currentMonthTotal - previousMonthTotal) / previousMonthTotal : 0;
      const trend: 'up' | 'down' | 'flat' =
        percentChange > 0.02 ? 'up' : percentChange < -0.02 ? 'down' : 'flat';

      // Calculate top merchants (group by merchant, sum amounts)
      const merchantMap = new Map<string, { merchant: string; total: number; count: number }>();
      for (const tx of currentMonthTransactions) {
        const merchantName = tx.merchant || tx.description.split(' ')[0] || 'Unknown';
        const existing = merchantMap.get(merchantName);
        if (existing) {
          existing.total += tx.amount;
          existing.count += 1;
        } else {
          merchantMap.set(merchantName, { merchant: merchantName, total: tx.amount, count: 1 });
        }
      }
      const topMerchants = Array.from(merchantMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Calculate top categories
      const categoryMap = new Map<
        string,
        { categoryId: string; name: string; icon: string | null; total: number; count: number }
      >();
      for (const tx of currentMonthTransactions) {
        if (!tx.category) continue;
        const existing = categoryMap.get(tx.category.id);
        if (existing) {
          existing.total += tx.amount;
          existing.count += 1;
        } else {
          categoryMap.set(tx.category.id, {
            categoryId: tx.category.id,
            name: tx.category.name,
            icon: tx.category.icon,
            total: tx.amount,
            count: 1,
          });
        }
      }
      const topCategories = Array.from(categoryMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Get largest transactions
      const largestTransactions = [...currentMonthTransactions]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map((tx) => ({
          id: tx.id,
          description: tx.description,
          merchant: tx.merchant,
          amount: tx.amount,
          date: tx.date,
          categoryName: tx.category?.name ?? null,
          categoryIcon: tx.category?.icon ?? null,
          accountName: tx.account?.name ?? null,
        }));

      // Currency formatter
      const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('he-IL', {
          style: 'currency',
          currency: 'ILS',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount);

      return {
        creditCardTotal,
        formattedCreditCardTotal: formatCurrency(creditCardTotal),
        expectedExpenses,
        formattedExpectedExpenses: formatCurrency(expectedExpenses),
        recurringTotal,
        formattedRecurringTotal: formatCurrency(recurringTotal),
        monthComparison: {
          currentMonth: currentMonthTotal,
          previousMonth: previousMonthTotal,
          percentChange,
          trend,
          formattedCurrentMonth: formatCurrency(currentMonthTotal),
          formattedPreviousMonth: formatCurrency(previousMonthTotal),
          formattedPercentChange: new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
            signDisplay: 'exceptZero',
          }).format(percentChange),
        },
        topMerchants: topMerchants.map((m) => ({
          ...m,
          formattedTotal: formatCurrency(m.total),
        })),
        topCategories: topCategories.map((c) => ({
          ...c,
          formattedTotal: formatCurrency(c.total),
        })),
        largestTransactions: largestTransactions.map((tx) => ({
          ...tx,
          formattedAmount: formatCurrency(tx.amount),
          formattedDate: new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
          }).format(new Date(tx.date)),
        })),
        lastSyncAt: lastSyncConnection?.lastSyncAt ?? null,
        lastSyncStatus: lastSyncConnection?.lastSyncStatus ?? null,
      };
    }),
});
