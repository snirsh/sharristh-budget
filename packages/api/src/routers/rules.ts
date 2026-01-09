import { createCategoryRuleSchema } from '@sfam/domain/schemas';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

export const rulesRouter = router({
  /**
   * List all rules
   */
  list: protectedProcedure
    .input(
      z
        .object({
          categoryId: z.string().optional(),
          type: z.enum(['merchant', 'keyword', 'regex']).optional(),
          includeInactive: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        householdId: ctx.householdId,
      };

      if (input?.categoryId) {
        where.categoryId = input.categoryId;
      }

      if (input?.type) {
        where.type = input.type;
      }

      if (!input?.includeInactive) {
        where.isActive = true;
      }

      return ctx.prisma.categoryRule.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });
    }),

  /**
   * Get single rule by ID
   */
  byId: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.categoryRule.findUnique({
      where: { id: input },
      include: {
        category: true,
      },
    });
  }),

  /**
   * Create a new rule
   */
  create: protectedProcedure.input(createCategoryRuleSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.categoryRule.create({
      data: {
        householdId: ctx.householdId,
        categoryId: input.categoryId,
        type: input.type,
        pattern: input.pattern,
        priority: input.priority ?? 5,
        isActive: true,
        createdFrom: 'manual',
      },
      include: {
        category: true,
      },
    });
  }),

  /**
   * Update a rule
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          categoryId: z.string().optional(),
          pattern: z.string().optional(),
          priority: z.number().optional(),
          isActive: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.categoryRule.update({
        where: { id: input.id, householdId: ctx.householdId },
        data: input.data,
        include: {
          category: true,
        },
      });
    }),

  /**
   * Delete a rule
   */
  delete: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.categoryRule.delete({
      where: { id: input, householdId: ctx.householdId },
    });
  }),

  /**
   * Toggle rule active status
   */
  toggle: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const rule = await ctx.prisma.categoryRule.findUnique({
      where: { id: input },
    });

    if (!rule) {
      throw new Error('Rule not found');
    }

    return ctx.prisma.categoryRule.update({
      where: { id: input },
      data: { isActive: !rule.isActive },
      include: {
        category: true,
      },
    });
  }),

  /**
   * Test a rule against sample text
   */
  test: protectedProcedure
    .input(
      z.object({
        type: z.enum(['merchant', 'keyword', 'regex']),
        pattern: z.string(),
        testText: z.string(),
      })
    )
    .query(({ input }) => {
      const textLower = input.testText.toLowerCase();
      const patternLower = input.pattern.toLowerCase();

      let matches = false;

      switch (input.type) {
        case 'merchant':
        case 'keyword':
          matches = textLower.includes(patternLower);
          break;
        case 'regex':
          try {
            const regex = new RegExp(input.pattern, 'i');
            matches = regex.test(input.testText);
          } catch {
            return { matches: false, error: 'Invalid regex pattern' };
          }
          break;
      }

      return { matches };
    }),

  /**
   * Clear all rules (delete all rules for the household)
   */
  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.categoryRule.deleteMany({
      where: { householdId: ctx.householdId },
    });
    return { deleted: result.count };
  }),

  /**
   * Batch delete rules
   */
  batchDelete: protectedProcedure
    .input(z.object({ ruleIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.categoryRule.deleteMany({
        where: {
          id: { in: input.ruleIds },
          householdId: ctx.householdId,
        },
      });
      return { deleted: result.count };
    }),

  /**
   * Batch toggle rules (activate/deactivate)
   */
  batchToggle: protectedProcedure
    .input(z.object({ ruleIds: z.array(z.string()).min(1), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.categoryRule.updateMany({
        where: {
          id: { in: input.ruleIds },
          householdId: ctx.householdId,
        },
        data: {
          isActive: input.isActive,
        },
      });
      return { updated: result.count };
    }),

  /**
   * Get rules with broken category references (category was deleted)
   */
  getBrokenRules: protectedProcedure.query(async ({ ctx }) => {
    const rules = await ctx.prisma.categoryRule.findMany({
      where: { householdId: ctx.householdId },
      include: { category: true },
    });
    // Filter rules where category is null (category was deleted)
    return rules.filter((rule) => !rule.category);
  }),
});
