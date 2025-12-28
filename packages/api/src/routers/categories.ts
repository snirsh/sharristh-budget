import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { createCategorySchema, updateCategorySchema } from '@sfam/domain/schemas';

export const categoriesRouter = router({
  /**
   * List all categories (optionally by type)
   */
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(['income', 'expected', 'varying']).optional(),
          includeInactive: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        householdId: ctx.householdId,
      };

      if (input?.type) {
        where.type = input.type;
      }

      if (!input?.includeInactive) {
        where.isActive = true;
      }

      return ctx.prisma.category.findMany({
        where,
        include: {
          children: {
            where: input?.includeInactive ? {} : { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          parent: true,
        },
        orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      });
    }),

  /**
   * Get category tree (hierarchical)
   */
  tree: protectedProcedure.query(async ({ ctx }) => {
    const categories = await ctx.prisma.category.findMany({
      where: {
        householdId: ctx.householdId,
        isActive: true,
        parentCategoryId: null, // Only top-level
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            children: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });

    return categories;
  }),

  /**
   * Get single category by ID
   */
  byId: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.category.findUnique({
      where: { id: input },
      include: {
        parent: true,
        children: true,
        budgets: {
          orderBy: { month: 'desc' },
          take: 12,
        },
      },
    });
  }),

  /**
   * Create a new category
   */
  create: protectedProcedure.input(createCategorySchema).mutation(async ({ ctx, input }) => {
    // Get max sort order for this type
    const maxSort = await ctx.prisma.category.aggregate({
      where: {
        householdId: ctx.householdId,
        type: input.type,
        parentCategoryId: input.parentCategoryId ?? null,
      },
      _max: { sortOrder: true },
    });

    return ctx.prisma.category.create({
      data: {
        householdId: ctx.householdId,
        name: input.name,
        type: input.type,
        parentCategoryId: input.parentCategoryId,
        icon: input.icon,
        color: input.color,
        sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
        isSystem: false,
      },
      include: {
        parent: true,
      },
    });
  }),

  /**
   * Update a category
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: updateCategorySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate that the category exists and belongs to this household
      const existingCategory = await ctx.prisma.category.findUnique({
        where: { id: input.id, householdId: ctx.householdId },
        include: { children: true },
      });

      if (!existingCategory) {
        throw new Error('Category not found');
      }

      // If changing parent, validate no circular reference
      if (input.data.parentCategoryId !== undefined) {
        if (input.data.parentCategoryId === input.id) {
          throw new Error('Category cannot be its own parent');
        }

        // Check that the new parent is not a descendant of this category
        if (input.data.parentCategoryId) {
          const isDescendant = async (
            categoryId: string,
            potentialAncestorId: string
          ): Promise<boolean> => {
            const category = await ctx.prisma.category.findUnique({
              where: { id: categoryId },
              select: { parentCategoryId: true },
            });
            if (!category?.parentCategoryId) return false;
            if (category.parentCategoryId === potentialAncestorId) return true;
            return isDescendant(category.parentCategoryId, potentialAncestorId);
          };

          const wouldCreateCycle = await isDescendant(
            input.data.parentCategoryId,
            input.id
          );
          if (wouldCreateCycle) {
            throw new Error('Cannot create circular category hierarchy');
          }

          // Validate parent exists and belongs to same household
          const parent = await ctx.prisma.category.findUnique({
            where: { id: input.data.parentCategoryId, householdId: ctx.householdId },
          });
          if (!parent) {
            throw new Error('Parent category not found');
          }

          // When setting a parent, inherit the type from the parent
          if (!input.data.type && parent.type !== existingCategory.type) {
            input.data.type = parent.type as 'income' | 'expected' | 'varying';
          }
        }
      }

      // If changing type and category has children, update children types too
      if (input.data.type && input.data.type !== existingCategory.type) {
        await ctx.prisma.category.updateMany({
          where: {
            householdId: ctx.householdId,
            parentCategoryId: input.id,
          },
          data: { type: input.data.type },
        });
      }

      return ctx.prisma.category.update({
        where: { id: input.id, householdId: ctx.householdId },
        data: input.data,
        include: {
          parent: true,
          children: true,
        },
      });
    }),

  /**
   * Disable a category (soft delete)
   */
  disable: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    // Also disable all children
    await ctx.prisma.category.updateMany({
      where: {
        householdId: ctx.householdId,
        parentCategoryId: input,
      },
      data: { isActive: false },
    });

    return ctx.prisma.category.update({
      where: { id: input, householdId: ctx.householdId },
      data: { isActive: false },
    });
  }),

  /**
   * Enable a category
   */
  enable: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.category.update({
      where: { id: input, householdId: ctx.householdId },
      data: { isActive: true },
    });
  }),

  /**
   * Reorder categories
   */
  reorder: protectedProcedure
    .input(
      z.array(
        z.object({
          id: z.string(),
          sortOrder: z.number(),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.map((item) =>
          ctx.prisma.category.update({
            where: { id: item.id, householdId: ctx.householdId },
            data: { sortOrder: item.sortOrder },
          })
        )
      );

      return { success: true };
    }),

  /**
   * Get information about what will be affected by deleting a category
   */
  getDeleteInfo: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const category = await ctx.prisma.category.findUnique({
      where: { id: input, householdId: ctx.householdId },
      include: {
        children: {
          include: {
            children: true, // Get grandchildren too
          },
        },
      },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Collect all descendant IDs recursively
    const getAllDescendantIds = (cat: typeof category): string[] => {
      const ids: string[] = [];
      if (cat.children) {
        for (const child of cat.children) {
          ids.push(child.id);
          ids.push(...getAllDescendantIds(child as typeof category));
        }
      }
      return ids;
    };

    const descendantIds = getAllDescendantIds(category);
    const allCategoryIds = [input, ...descendantIds];

    // Count transactions that will be affected
    const transactionCount = await ctx.prisma.transaction.count({
      where: {
        householdId: ctx.householdId,
        categoryId: { in: allCategoryIds },
      },
    });

    // Count budgets that will be affected
    const budgetCount = await ctx.prisma.budget.count({
      where: {
        householdId: ctx.householdId,
        categoryId: { in: allCategoryIds },
      },
    });

    // Count rules that will be affected
    const ruleCount = await ctx.prisma.categoryRule.count({
      where: {
        householdId: ctx.householdId,
        categoryId: { in: allCategoryIds },
      },
    });

    // Get subcategory details
    const subcategories = await ctx.prisma.category.findMany({
      where: {
        id: { in: descendantIds },
        householdId: ctx.householdId,
      },
      select: {
        id: true,
        name: true,
        icon: true,
      },
    });

    return {
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        isSystem: category.isSystem,
      },
      subcategories,
      affectedCounts: {
        transactions: transactionCount,
        budgets: budgetCount,
        rules: ruleCount,
      },
      canDelete: true,
    };
  }),

  /**
   * Delete a category and all its subcategories (hard delete)
   */
  delete: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const category = await ctx.prisma.category.findUnique({
      where: { id: input, householdId: ctx.householdId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Get all descendant IDs recursively
    const getAllDescendantIds = async (categoryId: string): Promise<string[]> => {
      const children = await ctx.prisma.category.findMany({
        where: { parentCategoryId: categoryId, householdId: ctx.householdId },
        select: { id: true },
      });

      const ids: string[] = [];
      for (const child of children) {
        ids.push(child.id);
        ids.push(...(await getAllDescendantIds(child.id)));
      }
      return ids;
    };

    const descendantIds = await getAllDescendantIds(input);
    const allCategoryIds = [input, ...descendantIds];

    // Use a transaction to ensure atomicity
    await ctx.prisma.$transaction(async (tx) => {
      // Unassign transactions (set categoryId to null)
      await tx.transaction.updateMany({
        where: {
          householdId: ctx.householdId,
          categoryId: { in: allCategoryIds },
        },
        data: { categoryId: null, needsReview: true },
      });

      // Delete budgets
      await tx.budget.deleteMany({
        where: {
          householdId: ctx.householdId,
          categoryId: { in: allCategoryIds },
        },
      });

      // Delete category rules
      await tx.categoryRule.deleteMany({
        where: {
          householdId: ctx.householdId,
          categoryId: { in: allCategoryIds },
        },
      });

      // Delete recurring templates' category references
      await tx.recurringTransactionTemplate.updateMany({
        where: {
          householdId: ctx.householdId,
          defaultCategoryId: { in: allCategoryIds },
        },
        data: { defaultCategoryId: null },
      });

      // Delete categories (children first, then parent)
      // Delete in reverse order to avoid foreign key issues
      for (const id of [...descendantIds].reverse()) {
        await tx.category.delete({
          where: { id, householdId: ctx.householdId },
        });
      }

      // Finally delete the main category
      await tx.category.delete({
        where: { id: input, householdId: ctx.householdId },
      });
    });

    return { success: true, deletedCount: allCategoryIds.length };
  }),

  /**
   * Seed default system categories for a new household
   */
  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if categories already exist
    const existingCount = await ctx.prisma.category.count({
      where: { householdId: ctx.householdId },
    });

    if (existingCount > 0) {
      return {
        success: false,
        message: 'Categories already exist for this household',
        categoriesCreated: 0,
      };
    }

    // Default categories for Israeli household budgeting (Bilingual: English (עברית))
    const defaultCategories = [
      // Income categories
      { name: 'Salary (משכורת)', type: 'income', icon: '💼', sortOrder: 1 },
      { name: 'Freelance (פרילנס)', type: 'income', icon: '💻', sortOrder: 2 },
      { name: 'Gifts (מתנות)', type: 'income', icon: '🎁', sortOrder: 3 },
      { name: 'Other Income (הכנסה אחרת)', type: 'income', icon: '💰', sortOrder: 4 },

      // Expected (Fixed) expenses
      { name: 'Rent (שכר דירה)', type: 'expected', icon: '🏠', sortOrder: 1 },
      { name: 'Electricity & Water (חשמל ומים)', type: 'expected', icon: '💡', sortOrder: 2 },
      { name: 'Insurance (ביטוחים)', type: 'expected', icon: '🛡️', sortOrder: 3 },
      { name: 'Phone & Internet (טלפון ואינטרנט)', type: 'expected', icon: '📱', sortOrder: 4 },
      { name: 'Loan Repayment (החזר הלוואה)', type: 'expected', icon: '🏦', sortOrder: 5 },
      { name: 'Income Tax (מס הכנסה)', type: 'expected', icon: '📊', sortOrder: 6 },
      { name: 'National Insurance (ביטוח לאומי)', type: 'expected', icon: '🏥', sortOrder: 7 },

      // Varying expenses
      { name: 'Groceries (מכולת)', type: 'varying', icon: '🛒', sortOrder: 1 },
      { name: 'Restaurants (מסעדות)', type: 'varying', icon: '🍽️', sortOrder: 2 },
      { name: 'Transportation (תחבורה)', type: 'varying', icon: '🚗', sortOrder: 3 },
      { name: 'Shopping (קניות)', type: 'varying', icon: '👕', sortOrder: 4 },
      { name: 'Entertainment (בילויים)', type: 'varying', icon: '🎬', sortOrder: 5 },
      { name: 'Healthcare (בריאות)', type: 'varying', icon: '💊', sortOrder: 6 },
      { name: 'Education (חינוך)', type: 'varying', icon: '📚', sortOrder: 7 },
      { name: 'Sports (ספורט)', type: 'varying', icon: '⚽', sortOrder: 8 },
      { name: 'Beauty & Care (טיפוח)', type: 'varying', icon: '💅', sortOrder: 9 },
      { name: 'Gifts & Events (מתנות ואירועים)', type: 'varying', icon: '🎉', sortOrder: 10 },
      { name: 'Pets (חיות מחמד)', type: 'varying', icon: '🐕', sortOrder: 11 },
      { name: 'Repairs (תיקונים)', type: 'varying', icon: '🔧', sortOrder: 12 },
      { name: 'Other (אחר)', type: 'varying', icon: '📦', sortOrder: 13 },
    ];

    // Create all categories
    const created = await Promise.all(
      defaultCategories.map((cat) =>
        ctx.prisma.category.create({
          data: {
            householdId: ctx.householdId,
            name: cat.name,
            type: cat.type as 'income' | 'expected' | 'varying',
            icon: cat.icon,
            sortOrder: cat.sortOrder,
            isSystem: true, // Mark as system-created
          },
        })
      )
    );

    return {
      success: true,
      message: `Created ${created.length} default categories`,
      categoriesCreated: created.length,
    };
  }),
});

