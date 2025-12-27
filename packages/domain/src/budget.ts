import type { Budget, BudgetStatus, BudgetEvaluation, Transaction, Category } from './types';

/**
 * Evaluates the status of a budget based on actual spending
 *
 * Status levels:
 * - ok: Under alert threshold
 * - nearing_limit: Between alert threshold and limit
 * - exceeded_soft: Over soft limit
 * - exceeded_hard: Over hard limit
 */
export function evaluateBudgetStatus(
  budget: Budget,
  actualAmount: number
): BudgetEvaluation {
  const percentUsed = budget.plannedAmount > 0 ? actualAmount / budget.plannedAmount : 0;
  const remaining = budget.plannedAmount - actualAmount;
  const isOverPlanned = actualAmount > budget.plannedAmount;

  let status: BudgetStatus = 'ok';
  let isOverLimit = false;

  if (budget.limitAmount !== null && budget.limitAmount !== undefined) {
    const limitPercentUsed = actualAmount / budget.limitAmount;

    if (actualAmount >= budget.limitAmount) {
      if (budget.limitType === 'hard') {
        status = 'exceeded_hard';
      } else {
        status = 'exceeded_soft';
      }
      isOverLimit = true;
    } else if (limitPercentUsed >= budget.alertThresholdPct) {
      status = 'nearing_limit';
    }
  } else if (isOverPlanned) {
    // No limit set, but over planned amount - treat as soft exceeded
    status = 'exceeded_soft';
  } else if (percentUsed >= budget.alertThresholdPct) {
    status = 'nearing_limit';
  }

  return {
    budget,
    actualAmount,
    percentUsed,
    status,
    remaining,
    isOverPlanned,
    isOverLimit,
  };
}

/**
 * Calculates actual spending for a category in a given month
 */
export function calculateCategorySpending(
  transactions: Transaction[],
  categoryId: string,
  month: string
): number {
  const [year, monthNum] = month.split('-').map(Number);
  if (year === undefined || monthNum === undefined) {
    return 0;
  }
  
  return transactions
    .filter((tx) => {
      if (tx.categoryId !== categoryId) return false;
      if (tx.direction !== 'expense') return false;

      const txDate = new Date(tx.date);
      return txDate.getFullYear() === year && txDate.getMonth() + 1 === monthNum;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Calculates category income for a given month
 */
export function calculateCategoryIncome(
  transactions: Transaction[],
  categoryId: string,
  month: string
): number {
  const [year, monthNum] = month.split('-').map(Number);
  if (year === undefined || monthNum === undefined) {
    return 0;
  }

  return transactions
    .filter((tx) => {
      if (tx.categoryId !== categoryId) return false;
      if (tx.direction !== 'income') return false;

      const txDate = new Date(tx.date);
      return txDate.getFullYear() === year && txDate.getMonth() + 1 === monthNum;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Evaluates all budgets for a month
 */
export function evaluateMonthlyBudgets(
  budgets: Budget[],
  transactions: Transaction[],
  month: string
): BudgetEvaluation[] {
  return budgets
    .filter((b) => b.month === month)
    .map((budget) => {
      const actualAmount = calculateCategorySpending(transactions, budget.categoryId, month);
      return evaluateBudgetStatus(budget, actualAmount);
    });
}

/**
 * Gets budgets that are nearing or exceeding limits
 */
export function getAlertBudgets(evaluations: BudgetEvaluation[]): BudgetEvaluation[] {
  return evaluations.filter(
    (e) => e.status === 'nearing_limit' || e.status === 'exceeded_soft' || e.status === 'exceeded_hard'
  );
}

/**
 * Calculates monthly KPIs
 */
export function calculateMonthlyKPIs(
  transactions: Transaction[],
  month: string
): {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
} {
  const [year, monthNum] = month.split('-').map(Number);
  if (year === undefined || monthNum === undefined) {
    return { totalIncome: 0, totalExpenses: 0, netSavings: 0, savingsRate: 0 };
  }

  const monthTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate.getFullYear() === year && txDate.getMonth() + 1 === monthNum;
  });

  const totalIncome = monthTransactions
    .filter((tx) => tx.direction === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = monthTransactions
    .filter((tx) => tx.direction === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? netSavings / totalIncome : 0;

  return {
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
  };
}

/**
 * Generates a summary for each category with budget
 */
export function getCategorySummaries(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
  month: string
): Array<{
  category: Category;
  budget: Budget | null;
  evaluation: BudgetEvaluation | null;
  transactionCount: number;
}> {
  return categories.map((category) => {
    const budget = budgets.find((b) => b.categoryId === category.id && b.month === month);
    
    let evaluation: BudgetEvaluation | null = null;
    if (budget) {
      const actualAmount = calculateCategorySpending(transactions, category.id, month);
      evaluation = evaluateBudgetStatus(budget, actualAmount);
    }

    const transactionCount = transactions.filter(
      (tx) => tx.categoryId === category.id
    ).length;

    return {
      category,
      budget: budget ?? null,
      evaluation,
      transactionCount,
    };
  });
}

/**
 * Status badge color mapping
 */
export function getBudgetStatusColor(status: BudgetStatus): string {
  switch (status) {
    case 'ok':
      return 'success';
    case 'nearing_limit':
      return 'warning';
    case 'exceeded_soft':
      return 'warning';
    case 'exceeded_hard':
      return 'danger';
    default:
      return 'gray';
  }
}

/**
 * Status label mapping
 */
export function getBudgetStatusLabel(status: BudgetStatus): string {
  switch (status) {
    case 'ok':
      return 'On Track';
    case 'nearing_limit':
      return 'Nearing Limit';
    case 'exceeded_soft':
      return 'Over Budget';
    case 'exceeded_hard':
      return 'Hard Limit Exceeded';
    default:
      return 'Unknown';
  }
}

