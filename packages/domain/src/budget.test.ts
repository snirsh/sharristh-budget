import { describe, it, expect } from 'vitest';
import {
  evaluateBudgetStatus,
  calculateCategorySpending,
  calculateMonthlyKPIs,
  getAlertBudgets,
} from './budget';
import type { Budget, Transaction } from './types';

describe('evaluateBudgetStatus', () => {
  const baseBudget: Budget = {
    id: 'budget-1',
    householdId: 'h1',
    categoryId: 'cat-1',
    month: '2024-12',
    plannedAmount: 1000,
    limitAmount: 1200,
    limitType: 'soft',
    alertThresholdPct: 0.8,
  };

  it('should return ok status when under threshold', () => {
    const result = evaluateBudgetStatus(baseBudget, 500);

    expect(result.status).toBe('ok');
    expect(result.percentUsed).toBe(0.5);
    expect(result.remaining).toBe(500);
    expect(result.isOverPlanned).toBe(false);
    expect(result.isOverLimit).toBe(false);
  });

  it('should return nearing_limit when approaching limit', () => {
    // 960 is 80% of limit (1200)
    const result = evaluateBudgetStatus(baseBudget, 1000);

    expect(result.status).toBe('nearing_limit');
    expect(result.isOverPlanned).toBe(false);
    expect(result.isOverLimit).toBe(false);
  });

  it('should return exceeded_soft when over soft limit', () => {
    const result = evaluateBudgetStatus(baseBudget, 1300);

    expect(result.status).toBe('exceeded_soft');
    expect(result.isOverPlanned).toBe(true);
    expect(result.isOverLimit).toBe(true);
  });

  it('should return exceeded_hard when over hard limit', () => {
    const hardBudget: Budget = {
      ...baseBudget,
      limitType: 'hard',
    };

    const result = evaluateBudgetStatus(hardBudget, 1300);

    expect(result.status).toBe('exceeded_hard');
    expect(result.isOverLimit).toBe(true);
  });

  it('should handle budget without limit', () => {
    const noLimitBudget: Budget = {
      ...baseBudget,
      limitAmount: null,
      limitType: null,
    };

    // Over planned but no limit set
    const result = evaluateBudgetStatus(noLimitBudget, 1100);

    expect(result.status).toBe('exceeded_soft');
    expect(result.isOverPlanned).toBe(true);
    expect(result.isOverLimit).toBe(false);
  });

  it('should handle zero planned amount', () => {
    const zeroBudget: Budget = {
      ...baseBudget,
      plannedAmount: 0,
    };

    const result = evaluateBudgetStatus(zeroBudget, 100);

    expect(result.percentUsed).toBe(0);
  });
});

describe('calculateCategorySpending', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 't1',
      householdId: 'h1',
      accountId: 'a1',
      categoryId: 'cat-food',
      date: new Date('2024-12-05'),
      description: 'Groceries',
      amount: 200,
      direction: 'expense',
      needsReview: false,
      isRecurringInstance: false,
    },
    {
      id: 't2',
      householdId: 'h1',
      accountId: 'a1',
      categoryId: 'cat-food',
      date: new Date('2024-12-15'),
      description: 'Restaurant',
      amount: 150,
      direction: 'expense',
      needsReview: false,
      isRecurringInstance: false,
    },
    {
      id: 't3',
      householdId: 'h1',
      accountId: 'a1',
      categoryId: 'cat-food',
      date: new Date('2024-11-10'),
      description: 'Last month groceries',
      amount: 300,
      direction: 'expense',
      needsReview: false,
      isRecurringInstance: false,
    },
    {
      id: 't4',
      householdId: 'h1',
      accountId: 'a1',
      categoryId: 'cat-salary',
      date: new Date('2024-12-01'),
      description: 'Salary',
      amount: 10000,
      direction: 'income',
      needsReview: false,
      isRecurringInstance: false,
    },
  ];

  it('should calculate spending for category in month', () => {
    const spending = calculateCategorySpending(mockTransactions, 'cat-food', '2024-12');

    expect(spending).toBe(350); // 200 + 150
  });

  it('should not include transactions from other months', () => {
    const spending = calculateCategorySpending(mockTransactions, 'cat-food', '2024-11');

    expect(spending).toBe(300);
  });

  it('should not include income transactions', () => {
    const spending = calculateCategorySpending(mockTransactions, 'cat-salary', '2024-12');

    expect(spending).toBe(0); // Income is not spending
  });

  it('should return 0 for non-existent category', () => {
    const spending = calculateCategorySpending(mockTransactions, 'cat-nonexistent', '2024-12');

    expect(spending).toBe(0);
  });
});

describe('calculateMonthlyKPIs', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 't1',
      householdId: 'h1',
      accountId: 'a1',
      categoryId: 'cat-salary',
      date: new Date('2024-12-01'),
      description: 'Salary',
      amount: 10000,
      direction: 'income',
      needsReview: false,
      isRecurringInstance: false,
    },
    {
      id: 't2',
      householdId: 'h1',
      accountId: 'a1',
      categoryId: 'cat-rent',
      date: new Date('2024-12-01'),
      description: 'Rent',
      amount: 5000,
      direction: 'expense',
      needsReview: false,
      isRecurringInstance: false,
    },
    {
      id: 't3',
      householdId: 'h1',
      accountId: 'a1',
      categoryId: 'cat-food',
      date: new Date('2024-12-10'),
      description: 'Groceries',
      amount: 1000,
      direction: 'expense',
      needsReview: false,
      isRecurringInstance: false,
    },
  ];

  it('should calculate correct KPIs', () => {
    const kpis = calculateMonthlyKPIs(mockTransactions, '2024-12');

    expect(kpis.totalIncome).toBe(10000);
    expect(kpis.totalExpenses).toBe(6000);
    expect(kpis.netSavings).toBe(4000);
    expect(kpis.savingsRate).toBe(0.4); // 40%
  });

  it('should handle month with no transactions', () => {
    const kpis = calculateMonthlyKPIs(mockTransactions, '2024-01');

    expect(kpis.totalIncome).toBe(0);
    expect(kpis.totalExpenses).toBe(0);
    expect(kpis.netSavings).toBe(0);
    expect(kpis.savingsRate).toBe(0);
  });
});

describe('getAlertBudgets', () => {
  it('should filter budgets with alert status', () => {
    const evaluations = [
      { budget: {} as Budget, actualAmount: 500, percentUsed: 0.5, status: 'ok' as const, remaining: 500, isOverPlanned: false, isOverLimit: false },
      { budget: {} as Budget, actualAmount: 850, percentUsed: 0.85, status: 'nearing_limit' as const, remaining: 150, isOverPlanned: false, isOverLimit: false },
      { budget: {} as Budget, actualAmount: 1100, percentUsed: 1.1, status: 'exceeded_soft' as const, remaining: -100, isOverPlanned: true, isOverLimit: true },
      { budget: {} as Budget, actualAmount: 1300, percentUsed: 1.3, status: 'exceeded_hard' as const, remaining: -300, isOverPlanned: true, isOverLimit: true },
    ];

    const alerts = getAlertBudgets(evaluations);

    expect(alerts).toHaveLength(3);
    expect(alerts.map(a => a.status)).toEqual(['nearing_limit', 'exceeded_soft', 'exceeded_hard']);
  });
});

