// Types
export * from './types';

// Categorization logic
export {
  categorizeTransaction,
  categorizeTransactions,
  suggestRuleFromCorrection,
} from './categorization';

// Budget evaluation logic
export {
  evaluateBudgetStatus,
  evaluateMonthlyBudgets,
  calculateCategorySpending,
  calculateCategoryIncome,
  calculateMonthlyKPIs,
  getAlertBudgets,
  getCategorySummaries,
  getBudgetStatusColor,
  getBudgetStatusLabel,
} from './budget';

// Recurring transaction logic
export {
  expandRecurringToRange,
  expandRecurringToMonth,
  generateMissingOccurrences,
  calculateNextRunAt,
  validateRecurringSchedule,
  getScheduleDescription,
} from './recurring';

// Utility functions
export function formatCurrency(amount: number, currency = 'ILS'): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year ?? '2024'), parseInt(monthNum ?? '1') - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

