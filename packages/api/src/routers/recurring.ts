import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  createRecurringTemplateSchema,
  updateRecurringTemplateSchema,
  recurringOverrideSchema,
} from '@sfam/domain/schemas';
import {
  expandRecurringToMonth,
  calculateNextRunAt,
  getScheduleDescription,
  detectRecurringPatterns,
  type RecurringTransactionTemplate,
  type RecurringOverride,
} from '@sfam/domain';

/**
 * Normalize merchant name for comparison (matches pattern-detection logic)
 */
function normalizeMerchantForComparison(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(ltd|inc|llc|corp|limited|co|company)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper to map Prisma types to domain types
function toRecurringTemplate(t: {
  id: string;
  householdId: string;
  name: string;
  direction: string;
  amount: number;
  defaultCategoryId?: string | null;
  description?: string | null;
  merchant?: string | null;
  accountId?: string | null;
  frequency: string;
  interval: number;
  byWeekday?: string | null;
  byMonthDay?: number | null;
  startDate: Date;
  endDate?: Date | null;
  timezone: string;
  isActive: boolean;
  nextRunAt?: Date | null;
  lastRunAt?: Date | null;
}): RecurringTransactionTemplate {
  return {
    ...t,
    direction: t.direction as 'income' | 'expense' | 'transfer',
    frequency: t.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate: new Date(t.startDate),
    endDate: t.endDate ? new Date(t.endDate) : undefined,
  };
}

function toRecurringOverrides(overrides: Array<{
  id: string;
  templateId: string;
  instanceKey: string;
  action: string;
  amount?: number | null;
  categoryId?: string | null;
  description?: string | null;
}>): RecurringOverride[] {
  return overrides.map(o => ({
    ...o,
    action: o.action as 'skip' | 'modify',
  }));
}

export const recurringRouter = router({
  /**
   * List all recurring templates
   */
  list: protectedProcedure
    .input(
      z
        .object({
          includeInactive: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const templates = await ctx.prisma.recurringTransactionTemplate.findMany({
        where: {
          householdId: ctx.householdId,
          ...(input?.includeInactive ? {} : { isActive: true }),
        },
        include: {
          category: true,
        },
        orderBy: { name: 'asc' },
      });

      return templates.map((t) => ({
        ...t,
        scheduleDescription: getScheduleDescription(toRecurringTemplate(t)),
      }));
    }),

  /**
   * Get single template by ID
   */
  byId: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const template = await ctx.prisma.recurringTransactionTemplate.findUnique({
      where: { id: input },
      include: {
        category: true,
        overrides: {
          orderBy: { instanceKey: 'desc' },
          take: 50,
        },
        transactions: {
          orderBy: { date: 'desc' },
          take: 12,
        },
      },
    });

    if (!template) return null;

    return {
      ...template,
      scheduleDescription: getScheduleDescription(toRecurringTemplate(template)),
    };
  }),

  /**
   * Create a new recurring template
   */
  create: protectedProcedure.input(createRecurringTemplateSchema).mutation(async ({ ctx, input }) => {
    const nextRunAt = calculateNextRunAt({
      ...input,
      id: '',
      householdId: ctx.householdId,
      timezone: 'Asia/Jerusalem',
      isActive: true,
    } as Parameters<typeof calculateNextRunAt>[0]);

    return ctx.prisma.recurringTransactionTemplate.create({
      data: {
        householdId: ctx.householdId,
        name: input.name,
        direction: input.direction,
        amount: input.amount,
        defaultCategoryId: input.defaultCategoryId,
        description: input.description,
        merchant: input.merchant,
        accountId: input.accountId,
        frequency: input.frequency,
        interval: input.interval,
        byWeekday: input.byWeekday,
        byMonthDay: input.byMonthDay,
        startDate: input.startDate,
        endDate: input.endDate,
        timezone: 'Asia/Jerusalem',
        isActive: true,
        nextRunAt,
      },
      include: {
        category: true,
      },
    });
  }),

  /**
   * Update a recurring template (affects future only)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: updateRecurringTemplateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.prisma.recurringTransactionTemplate.findUnique({
        where: { id: input.id },
      });

      if (!current) {
        throw new Error('Template not found');
      }

      const updateData = { ...input.data };

      // Recalculate next run if schedule changed
      if (
        input.data.frequency ||
        input.data.interval ||
        input.data.byWeekday ||
        input.data.byMonthDay ||
        input.data.isActive !== undefined
      ) {
        const merged = {
          ...current,
          ...updateData,
          startDate: new Date(current.startDate),
          endDate: current.endDate ? new Date(current.endDate) : undefined,
        };

        const nextRunAt = calculateNextRunAt(merged as Parameters<typeof calculateNextRunAt>[0]);
        (updateData as Record<string, unknown>).nextRunAt = nextRunAt;
      }

      return ctx.prisma.recurringTransactionTemplate.update({
        where: { id: input.id, householdId: ctx.householdId },
        data: updateData,
        include: {
          category: true,
        },
      });
    }),

  /**
   * Delete a recurring template
   */
  delete: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.recurringTransactionTemplate.delete({
      where: { id: input, householdId: ctx.householdId },
    });
  }),

  /**
   * Get expanded occurrences for a month
   */
  occurrences: protectedProcedure
    .input(
      z.object({
        templateId: z.string().optional(),
        year: z.number(),
        month: z.number().min(1).max(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        householdId: ctx.householdId,
        isActive: true,
      };

      if (input.templateId) {
        where.id = input.templateId;
      }

      const templates = await ctx.prisma.recurringTransactionTemplate.findMany({
        where,
        include: {
          overrides: true,
          category: true,
        },
      });

      // Get existing transactions for this month
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0);

      const existingTransactions = await ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
          isRecurringInstance: true,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          recurringTemplateId: true,
          recurringInstanceKey: true,
        },
      });

      const existingKeys = new Set(
        existingTransactions.map((t) => `${t.recurringTemplateId}_${t.recurringInstanceKey}`)
      );

      // Expand all templates
      const allOccurrences = templates.flatMap((template) => {
        const occurrences = expandRecurringToMonth(
          toRecurringTemplate(template),
          input.year,
          input.month,
          toRecurringOverrides(template.overrides)
        );

        return occurrences.map((occ) => ({
          ...occ,
          templateName: template.name,
          category: template.category,
          isGenerated: existingKeys.has(`${template.id}_${occ.instanceKey}`),
        }));
      });

      return allOccurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
    }),

  /**
   * Create an override for a specific occurrence
   */
  override: protectedProcedure.input(recurringOverrideSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.recurringOverride.upsert({
      where: {
        templateId_instanceKey: {
          templateId: input.templateId,
          instanceKey: input.instanceKey,
        },
      },
      create: {
        templateId: input.templateId,
        instanceKey: input.instanceKey,
        action: input.action,
        amount: input.amount,
        categoryId: input.categoryId,
        description: input.description,
      },
      update: {
        action: input.action,
        amount: input.amount,
        categoryId: input.categoryId,
        description: input.description,
      },
    });
  }),

  /**
   * Generate missing occurrences as actual transactions
   */
  generateOccurrences: protectedProcedure
    .input(
      z.object({
        templateId: z.string().optional(),
        upToDate: z.coerce.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        householdId: ctx.householdId,
        isActive: true,
      };

      if (input.templateId) {
        where.id = input.templateId;
      }

      const templates = await ctx.prisma.recurringTransactionTemplate.findMany({
        where,
        include: {
          overrides: true,
        },
      });

      // Get default account
      const defaultAccount = await ctx.prisma.account.findFirst({
        where: { householdId: ctx.householdId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!defaultAccount) {
        throw new Error('No active account found');
      }

      let createdCount = 0;

      for (const template of templates) {
        // Get existing instances
        const existing = await ctx.prisma.transaction.findMany({
          where: {
            recurringTemplateId: template.id,
          },
          select: {
            recurringInstanceKey: true,
          },
        });

        const existingKeys = new Set(existing.map((t) => t.recurringInstanceKey));

        // Expand to get all occurrences
        const occurrences = expandRecurringToMonth(
          toRecurringTemplate(template),
          input.upToDate.getFullYear(),
          input.upToDate.getMonth() + 1,
          toRecurringOverrides(template.overrides)
        );

        // Filter to missing ones
        const missing = occurrences.filter(
          (occ) => !existingKeys.has(occ.instanceKey) && occ.date <= input.upToDate
        );

        // Create transactions
        for (const occ of missing) {
          await ctx.prisma.transaction.create({
            data: {
              householdId: ctx.householdId,
              accountId: template.accountId || defaultAccount.id,
              date: occ.date,
              description: occ.description,
              merchant: occ.merchant,
              amount: occ.amount,
              direction: occ.direction,
              categoryId: occ.categoryId,
              categorizationSource: 'manual',
              confidence: 1,
              isRecurringInstance: true,
              recurringTemplateId: template.id,
              recurringInstanceKey: occ.instanceKey,
              needsReview: false,
            },
          });
          createdCount++;
        }

        // Update lastRunAt
        if (missing.length > 0) {
          const lastOcc = missing[missing.length - 1];
          await ctx.prisma.recurringTransactionTemplate.update({
            where: { id: template.id },
            data: {
              lastRunAt: lastOcc?.date,
              nextRunAt: calculateNextRunAt(
                toRecurringTemplate(template),
                lastOcc?.date
              ),
            },
          });
        }
      }

      return { created: createdCount };
    }),

  /**
   * Detect recurring transaction patterns
   */
  detectPatterns: protectedProcedure
    .input(
      z
        .object({
          lookbackMonths: z.number().min(1).max(24).optional(),
          minOccurrences: z.number().min(2).max(10).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Get all expense transactions for the household
      const transactions = await ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
          direction: 'expense',
          isRecurringInstance: false, // Exclude existing recurring instances
        },
        orderBy: { date: 'desc' },
      });

      // Get existing active recurring templates to exclude their merchants
      const existingTemplates = await ctx.prisma.recurringTransactionTemplate.findMany({
        where: {
          householdId: ctx.householdId,
          isActive: true,
        },
        select: {
          merchant: true,
        },
      });

      // Create set of existing merchants (normalized for comparison)
      const existingMerchants = new Set(
        existingTemplates
          .filter((t) => t.merchant)
          .map((t) => normalizeMerchantForComparison(t.merchant!))
      );

      // Map to domain type
      const domainTransactions = transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        merchant: tx.merchant,
        amount: tx.amount,
        direction: tx.direction as 'income' | 'expense' | 'transfer',
      }));

      // Detect patterns
      const allPatterns = detectRecurringPatterns(domainTransactions, input);

      // Filter out patterns for merchants that already have templates
      const newPatterns = allPatterns.filter(
        (pattern) => !existingMerchants.has(normalizeMerchantForComparison(pattern.merchant))
      );

      return newPatterns;
    }),

  /**
   * Create recurring template from detected pattern
   */
  createFromPattern: protectedProcedure
    .input(
      z.object({
        merchant: z.string(),
        amount: z.number().positive(),
        categoryId: z.string().optional(),
        frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
        interval: z.number().int().positive(),
        byMonthDay: z.number().int().min(1).max(31).optional(),
        startDate: z.date(),
        accountId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate category if provided
      if (input.categoryId) {
        const category = await ctx.prisma.category.findFirst({
          where: {
            id: input.categoryId,
            householdId: ctx.householdId,
          },
        });

        if (!category) {
          throw new Error('Category not found or does not belong to your household');
        }
      }

      // Validate account if provided
      if (input.accountId) {
        const account = await ctx.prisma.account.findFirst({
          where: {
            id: input.accountId,
            householdId: ctx.householdId,
          },
        });

        if (!account) {
          throw new Error('Account not found or does not belong to your household');
        }
      }

      // Create template
      const template = await ctx.prisma.recurringTransactionTemplate.create({
        data: {
          householdId: ctx.householdId,
          name: `${input.merchant} (recurring)`,
          merchant: input.merchant,
          direction: 'expense',
          amount: input.amount,
          defaultCategoryId: input.categoryId,
          accountId: input.accountId,
          frequency: input.frequency,
          interval: input.interval,
          byMonthDay: input.byMonthDay,
          startDate: input.startDate,
          timezone: 'Asia/Jerusalem',
          isActive: true,
          nextRunAt: calculateNextRunAt(
            {
              id: '',
              householdId: ctx.householdId,
              name: input.merchant,
              direction: 'expense',
              amount: input.amount,
              frequency: input.frequency,
              interval: input.interval,
              byMonthDay: input.byMonthDay,
              startDate: input.startDate,
              timezone: 'Asia/Jerusalem',
              isActive: true,
            },
            input.startDate
          ),
        },
        include: {
          category: true,
        },
      });

      return template;
    }),
});

