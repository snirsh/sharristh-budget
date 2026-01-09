// ============================================
// Core Types
// ============================================

export type TransactionDirection = 'income' | 'expense' | 'transfer';
export type CategoryType = 'income' | 'expense';
export type LimitType = 'soft' | 'hard';
export type CategorizationSource =
  | 'manual'
  | 'rule_merchant'
  | 'rule_keyword'
  | 'rule_regex'
  | 'ai_suggestion'
  | 'fallback';
export type RuleType = 'merchant' | 'keyword' | 'regex';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type BudgetStatus = 'ok' | 'nearing_limit' | 'exceeded_soft' | 'exceeded_hard';

// ============================================
// Transaction Types
// ============================================

export interface Transaction {
  id: string;
  householdId: string;
  accountId: string;
  userId?: string | null;
  categoryId?: string | null;
  date: Date;
  description: string;
  merchant?: string | null;
  amount: number;
  direction: TransactionDirection;
  categorizationSource?: CategorizationSource | null;
  confidence?: number | null;
  notes?: string | null;
  needsReview: boolean;
  isIgnored: boolean;
  isRecurringInstance: boolean;
  recurringTemplateId?: string | null;
  recurringInstanceKey?: string | null;
}

export interface TransactionInput {
  description: string;
  merchant?: string | null;
  amount: number;
  direction: TransactionDirection;
  categoryId?: string | null;
}

// ============================================
// Category Types
// ============================================

export interface Category {
  id: string;
  householdId: string;
  name: string;
  type: CategoryType;
  parentCategoryId?: string | null;
  icon?: string | null;
  color?: string | null;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

/**
 * Minimal category interface for categorization
 * Used when only id, name, and type are needed (e.g., AI categorization)
 */
export interface CategoryForCategorization {
  id: string;
  name: string;
  type: CategoryType;
}

// ============================================
// Category Rule Types
// ============================================

export interface CategoryRule {
  id: string;
  householdId: string;
  categoryId: string;
  type: RuleType;
  pattern: string;
  priority: number;
  isActive: boolean;
}

// ============================================
// Budget Types
// ============================================

export interface Budget {
  id: string;
  householdId: string;
  categoryId: string;
  month: string; // YYYY-MM
  plannedAmount: number;
  limitAmount?: number | null;
  limitType?: LimitType | null;
  alertThresholdPct: number;
}

export interface BudgetEvaluation {
  budget: Budget;
  actualAmount: number;
  percentUsed: number;
  status: BudgetStatus;
  remaining: number;
  isOverPlanned: boolean;
  isOverLimit: boolean;
}

// ============================================
// Recurring Transaction Types
// ============================================

export interface RecurringTransactionTemplate {
  id: string;
  householdId: string;
  name: string;
  direction: TransactionDirection;
  amount: number;
  defaultCategoryId?: string | null;
  description?: string | null;
  merchant?: string | null;
  accountId?: string | null;
  frequency: RecurringFrequency;
  interval: number;
  byWeekday?: string | null;
  byMonthDay?: number | null;
  startDate: Date;
  endDate?: Date | null;
  timezone: string;
  isActive: boolean;
  nextRunAt?: Date | null;
  lastRunAt?: Date | null;
}

export interface RecurringOverride {
  id: string;
  templateId: string;
  instanceKey: string; // YYYY-MM-DD
  action: 'skip' | 'modify';
  amount?: number | null;
  categoryId?: string | null;
  description?: string | null;
}

export interface RecurringOccurrence {
  templateId: string;
  date: Date;
  instanceKey: string;
  amount: number;
  categoryId?: string | null;
  description: string;
  merchant?: string | null;
  direction: TransactionDirection;
  isOverridden: boolean;
  isSkipped: boolean;
}

// ============================================
// Categorization Result
// ============================================

export interface CategorizationResult {
  categoryId: string | null;
  confidence: number;
  source: CategorizationSource;
  reason: string;
  matchedRule?: CategoryRule | null;
}

// ============================================
// Dashboard Types
// ============================================

export interface MonthlyKPI {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
}

export interface CategorySummary {
  category: Category;
  plannedAmount: number;
  actualAmount: number;
  percentUsed: number;
  status: BudgetStatus;
  transactions: number;
}
