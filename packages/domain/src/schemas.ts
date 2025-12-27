import { z } from 'zod';

// ============================================
// Enums as Zod Schemas
// ============================================

export const transactionDirectionSchema = z.enum(['income', 'expense', 'transfer']);
export const categoryTypeSchema = z.enum(['income', 'expected', 'varying']);
export const limitTypeSchema = z.enum(['soft', 'hard']);
export const categorizationSourceSchema = z.enum([
  'manual',
  'rule_merchant',
  'rule_keyword',
  'rule_regex',
  'fallback',
]);
export const ruleTypeSchema = z.enum(['merchant', 'keyword', 'regex']);
export const recurringFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);
export const budgetStatusSchema = z.enum(['ok', 'nearing_limit', 'exceeded_soft', 'exceeded_hard']);

// ============================================
// Transaction Schemas
// ============================================

export const transactionSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  accountId: z.string(),
  userId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  date: z.coerce.date(),
  description: z.string().min(1),
  merchant: z.string().nullable().optional(),
  amount: z.number().positive(),
  direction: transactionDirectionSchema,
  categorizationSource: categorizationSourceSchema.nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  notes: z.string().nullable().optional(),
  needsReview: z.boolean().default(false),
  isRecurringInstance: z.boolean().default(false),
  recurringTemplateId: z.string().nullable().optional(),
  recurringInstanceKey: z.string().nullable().optional(),
});

export const createTransactionSchema = z.object({
  accountId: z.string(),
  date: z.coerce.date(),
  description: z.string().min(1),
  merchant: z.string().optional(),
  amount: z.number().positive(),
  direction: transactionDirectionSchema,
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});

export const updateTransactionSchema = z.object({
  categoryId: z.string().nullable().optional(),
  description: z.string().min(1).optional(),
  merchant: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  notes: z.string().nullable().optional(),
  needsReview: z.boolean().optional(),
});

// ============================================
// Category Schemas
// ============================================

export const categorySchema = z.object({
  id: z.string(),
  householdId: z.string(),
  name: z.string().min(1),
  type: categoryTypeSchema,
  parentCategoryId: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  isSystem: z.boolean().default(false),
  sortOrder: z.number().default(0),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  type: categoryTypeSchema,
  parentCategoryId: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  type: categoryTypeSchema.optional(),
  parentCategoryId: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

// ============================================
// Category Rule Schemas
// ============================================

export const categoryRuleSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  categoryId: z.string(),
  type: ruleTypeSchema,
  pattern: z.string().min(1),
  priority: z.number().default(0),
  isActive: z.boolean().default(true),
});

export const createCategoryRuleSchema = z.object({
  categoryId: z.string(),
  type: ruleTypeSchema,
  pattern: z.string().min(1),
  priority: z.number().optional(),
});

// ============================================
// Budget Schemas
// ============================================

export const budgetSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  categoryId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  plannedAmount: z.number().min(0),
  limitAmount: z.number().min(0).nullable().optional(),
  limitType: limitTypeSchema.nullable().optional(),
  alertThresholdPct: z.number().min(0).max(1).default(0.8),
});

export const createBudgetSchema = z.object({
  categoryId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  plannedAmount: z.number().min(0),
  limitAmount: z.number().min(0).optional(),
  limitType: limitTypeSchema.optional(),
  alertThresholdPct: z.number().min(0).max(1).optional(),
});

export const updateBudgetSchema = z.object({
  plannedAmount: z.number().min(0).optional(),
  limitAmount: z.number().min(0).nullable().optional(),
  limitType: limitTypeSchema.nullable().optional(),
  alertThresholdPct: z.number().min(0).max(1).optional(),
});

// ============================================
// Recurring Transaction Schemas
// ============================================

export const recurringTemplateSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  name: z.string().min(1),
  direction: transactionDirectionSchema,
  amount: z.number().positive(),
  defaultCategoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  frequency: recurringFrequencySchema,
  interval: z.number().int().positive().default(1),
  byWeekday: z.string().nullable().optional(),
  byMonthDay: z.number().int().min(1).max(31).nullable().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  timezone: z.string().default('Asia/Jerusalem'),
  isActive: z.boolean().default(true),
  nextRunAt: z.coerce.date().nullable().optional(),
  lastRunAt: z.coerce.date().nullable().optional(),
});

export const createRecurringTemplateSchema = z.object({
  name: z.string().min(1),
  direction: transactionDirectionSchema,
  amount: z.number().positive(),
  defaultCategoryId: z.string().optional(),
  description: z.string().optional(),
  merchant: z.string().optional(),
  accountId: z.string().optional(),
  frequency: recurringFrequencySchema,
  interval: z.number().int().positive().default(1),
  byWeekday: z.string().optional(),
  byMonthDay: z.number().int().min(1).max(31).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const updateRecurringTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  defaultCategoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  frequency: recurringFrequencySchema.optional(),
  interval: z.number().int().positive().optional(),
  byWeekday: z.string().nullable().optional(),
  byMonthDay: z.number().int().min(1).max(31).nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const recurringOverrideSchema = z.object({
  templateId: z.string(),
  instanceKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(['skip', 'modify']),
  amount: z.number().positive().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
});

// ============================================
// Filter Schemas
// ============================================

export const transactionFiltersSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  direction: transactionDirectionSchema.optional(),
  needsReview: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

// Type exports
export type TransactionSchema = z.infer<typeof transactionSchema>;
export type CreateTransactionSchema = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionSchema = z.infer<typeof updateTransactionSchema>;
export type CategorySchema = z.infer<typeof categorySchema>;
export type CreateCategorySchema = z.infer<typeof createCategorySchema>;
export type UpdateCategorySchema = z.infer<typeof updateCategorySchema>;
export type CategoryRuleSchema = z.infer<typeof categoryRuleSchema>;
export type CreateCategoryRuleSchema = z.infer<typeof createCategoryRuleSchema>;
export type BudgetSchema = z.infer<typeof budgetSchema>;
export type CreateBudgetSchema = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetSchema = z.infer<typeof updateBudgetSchema>;
export type RecurringTemplateSchema = z.infer<typeof recurringTemplateSchema>;
export type CreateRecurringTemplateSchema = z.infer<typeof createRecurringTemplateSchema>;
export type UpdateRecurringTemplateSchema = z.infer<typeof updateRecurringTemplateSchema>;
export type RecurringOverrideSchema = z.infer<typeof recurringOverrideSchema>;
export type TransactionFiltersSchema = z.infer<typeof transactionFiltersSchema>;

