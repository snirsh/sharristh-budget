import type { PrismaClient } from '@sfam/db';
import { createCategorySchema, updateCategorySchema } from '@sfam/domain/schemas';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

export const categoriesRouter = router({
  /**
   * List all categories (optionally by type)
   */
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(['income', 'expense']).optional(),
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
    return ctx.prisma.category.findMany({
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

    const category = await ctx.prisma.category.create({
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

    return category;
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

          const wouldCreateCycle = await isDescendant(input.data.parentCategoryId, input.id);
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
            input.data.type = parent.type as 'income' | 'expense';
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

      const updatedCategory = await ctx.prisma.category.update({
        where: { id: input.id, householdId: ctx.householdId },
        data: input.data,
        include: {
          parent: true,
          children: true,
        },
      });

      return updatedCategory;
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

    const disabledCategory = await ctx.prisma.category.update({
      where: { id: input, householdId: ctx.householdId },
      data: { isActive: false },
    });

    return disabledCategory;
  }),

  /**
   * Enable a category
   */
  enable: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const enabledCategory = await ctx.prisma.category.update({
      where: { id: input, householdId: ctx.householdId },
      data: { isActive: true },
    });

    return enabledCategory;
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
    await ctx.prisma.$transaction(
      async (
        tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
      ) => {
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
      }
    );

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

    // Income categories (flat, no subcategories)
    const incomeCategories = [
      { name: 'Salary (משכורת)', icon: '💼', sortOrder: 1 },
      { name: 'Freelance / Side Jobs (עבודות צד/פרילנס)', icon: '💻', sortOrder: 2 },
      { name: 'Government Benefits (קצבאות והטבות)', icon: '🏛️', sortOrder: 3 },
      { name: 'Refunds & Reimbursements (החזרי כספים)', icon: '↩️', sortOrder: 4 },
      { name: 'Investments & Interest (השקעות וריבית)', icon: '📈', sortOrder: 5 },
      { name: 'Gifts & Transfers (מתנות והעברות)', icon: '🎁', sortOrder: 6 },
      { name: 'Other Income (הכנסה אחרת)', icon: '💰', sortOrder: 7 },
    ];

    // Expense categories with subcategories
    const expenseCategories = [
      {
        name: 'Housing (דיור)',
        icon: '🏠',
        sortOrder: 1,
        subcategories: [
          { name: 'Rent / Mortgage (שכר דירה / משכנתא)', icon: '🏘️', sortOrder: 1 },
          { name: 'Arnona (ארנונה)', icon: '🏛️', sortOrder: 2 },
          { name: 'Building Fee (ועד בית)', icon: '🏢', sortOrder: 3 },
          { name: 'Repairs & Maintenance (תיקונים ותחזוקה)', icon: '🔧', sortOrder: 4 },
          { name: 'Home Insurance (ביטוח דירה)', icon: '🛡️', sortOrder: 5 },
        ],
      },
      {
        name: 'Utilities (חשמל ומים)',
        icon: '💡',
        sortOrder: 2,
        subcategories: [
          { name: 'Electricity (חשמל)', icon: '⚡', sortOrder: 1 },
          { name: 'Water (מים)', icon: '💧', sortOrder: 2 },
          { name: 'Gas (גז)', icon: '🔥', sortOrder: 3 },
          { name: 'Internet (אינטרנט)', icon: '🌐', sortOrder: 4 },
          { name: 'Cell Phones (סלולר)', icon: '📱', sortOrder: 5 },
          { name: 'TV / Streaming (טלויזיה/סטרימינג)', icon: '📺', sortOrder: 6 },
        ],
      },
      {
        name: 'Groceries & Household (מזון ומשק בית)',
        icon: '🛒',
        sortOrder: 3,
        subcategories: [
          { name: 'Supermarket (סופרמרקט)', icon: '🏪', sortOrder: 1 },
          { name: 'Household Supplies (חומרי ניקוי וציוד)', icon: '🧹', sortOrder: 2 },
          { name: 'Baby Supplies (ציוד לתינוק)', icon: '👶', sortOrder: 3 },
        ],
      },
      {
        name: 'Eating & Drinking (אוכל בחוץ)',
        icon: '🍽️',
        sortOrder: 4,
        subcategories: [
          { name: 'Restaurants (מסעדות)', icon: '🍴', sortOrder: 1 },
          { name: 'Coffee & Snacks (קפה ונשנושים)', icon: '☕', sortOrder: 2 },
          { name: 'Delivery (משלוחים)', icon: '🚚', sortOrder: 3 },
        ],
      },
      {
        name: 'Transportation (תחבורה)',
        icon: '🚗',
        sortOrder: 5,
        subcategories: [
          { name: 'Fuel (דלק)', icon: '⛽', sortOrder: 1 },
          { name: 'Public Transport (תחבורה ציבורית)', icon: '🚌', sortOrder: 2 },
          { name: 'Taxi / Ride-Share (מוניות/שיתופי נסיעות)', icon: '🚕', sortOrder: 3 },
          { name: 'Car Maintenance (טיפולים לרכב)', icon: '🔧', sortOrder: 4 },
          { name: 'Car Insurance (ביטוח רכב)', icon: '🚙', sortOrder: 5 },
          { name: 'Parking (חניה)', icon: '🅿️', sortOrder: 6 },
        ],
      },
      {
        name: 'Kids & Family (ילדים ומשפחה)',
        icon: '👨‍👩‍👧‍👦',
        sortOrder: 6,
        subcategories: [
          { name: 'Daycare (גן/מעון)', icon: '🏫', sortOrder: 1 },
          { name: 'Activities (חוגים ופעילויות)', icon: '🎨', sortOrder: 2 },
          { name: 'Clothing (בגדים)', icon: '👕', sortOrder: 3 },
          { name: 'Health / Medicines (בריאות ותרופות)', icon: '💊', sortOrder: 4 },
        ],
      },
      {
        name: 'Health & Wellness (בריאות וכושר)',
        icon: '💊',
        sortOrder: 7,
        subcategories: [
          { name: 'Health Insurance (ביטוח בריאות)', icon: '🏥', sortOrder: 1 },
          { name: 'Medicines (תרופות)', icon: '💉', sortOrder: 2 },
          { name: 'Doctor / Dentist (רופאים/שיניים)', icon: '🦷', sortOrder: 3 },
          { name: 'Gym / Sports (חדר כושר/ספורט)', icon: '💪', sortOrder: 4 },
        ],
      },
      {
        name: 'Insurance (ביטוחים)',
        icon: '🛡️',
        sortOrder: 8,
        subcategories: [
          { name: 'Life (ביטוח חיים)', icon: '❤️', sortOrder: 1 },
          { name: 'Car (ביטוח רכב)', icon: '🚗', sortOrder: 2 },
          { name: 'Home (ביטוח דירה)', icon: '🏠', sortOrder: 3 },
          { name: 'Travel (ביטוח נסיעות)', icon: '✈️', sortOrder: 4 },
        ],
      },
      {
        name: 'Education & Personal Growth (לימודים והתפתחות)',
        icon: '📚',
        sortOrder: 9,
        subcategories: [
          { name: 'Courses (קורסים)', icon: '🎓', sortOrder: 1 },
          { name: 'Books (ספרים)', icon: '📖', sortOrder: 2 },
          { name: 'Workshops (סדנאות)', icon: '🛠️', sortOrder: 3 },
        ],
      },
      {
        name: 'Financial Commitments (התחייבויות פיננסיות)',
        icon: '💳',
        sortOrder: 10,
        subcategories: [
          { name: 'Loans (הלוואות)', icon: '🏦', sortOrder: 1 },
          { name: 'Credit Card Interest (ריביות כרטיסי אשראי)', icon: '💳', sortOrder: 2 },
          { name: 'Bank Fees (עמלות בנק)', icon: '🏧', sortOrder: 3 },
        ],
      },
      {
        name: 'Subscriptions (מנויים)',
        icon: '📱',
        sortOrder: 11,
        subcategories: [
          { name: 'Software (תוכנות)', icon: '💻', sortOrder: 1 },
          { name: 'Streaming (סטרימינג)', icon: '📺', sortOrder: 2 },
          { name: 'Cloud Storage (אחסון בענן)', icon: '☁️', sortOrder: 3 },
          { name: 'Other Services (שירותים נוספים)', icon: '🔄', sortOrder: 4 },
        ],
      },
      {
        name: 'Leisure & Lifestyle (פנאי וסגנון חיים)',
        icon: '🎭',
        sortOrder: 12,
        subcategories: [
          { name: 'Hobbies (תחביבים)', icon: '🎨', sortOrder: 1 },
          { name: 'Entertainment (בידור)', icon: '🎬', sortOrder: 2 },
          { name: 'Vacations (חופשות)', icon: '🏖️', sortOrder: 3 },
          { name: 'Gifts (מתנות)', icon: '🎁', sortOrder: 4 },
          { name: 'Haircuts (תספורות)', icon: '💇', sortOrder: 5 },
        ],
      },
      {
        name: 'Pets (חיות מחמד)',
        icon: '🐕',
        sortOrder: 13,
        subcategories: [
          { name: 'Food (מזון)', icon: '🍖', sortOrder: 1 },
          { name: 'Vet (וטרינר)', icon: '🏥', sortOrder: 2 },
          { name: 'Supplies (ציוד)', icon: '🦴', sortOrder: 3 },
          { name: 'Pet Insurance (ביטוח חיות מחמד)', icon: '🐶', sortOrder: 4 },
        ],
      },
      {
        name: 'Charity & Donations (תרומות)',
        icon: '❤️',
        sortOrder: 14,
        subcategories: [
          { name: 'Nonprofits (עמותות)', icon: '🏛️', sortOrder: 1 },
          { name: 'Community Giving (תרומות קהילה)', icon: '🤝', sortOrder: 2 },
          { name: 'Donations (תרומות)', icon: '💰', sortOrder: 3 },
        ],
      },
      {
        name: 'Savings & Investments (חסכונות והשקעות)',
        icon: '💰',
        sortOrder: 15,
        subcategories: [
          { name: 'Emergency Fund (קרן חירום)', icon: '🆘', sortOrder: 1 },
          { name: 'Long-term Savings (חיסכון לטווח ארוך)', icon: '📊', sortOrder: 2 },
          { name: 'Investments (השקעות)', icon: '📈', sortOrder: 3 },
        ],
      },
      {
        name: 'Unexpected / Irregular (חד-פעמי / בלתי צפוי)',
        icon: '❗',
        sortOrder: 16,
        subcategories: [
          { name: 'Repairs (תיקונים)', icon: '🔧', sortOrder: 1 },
          { name: 'One-time Purchases (רכישות גדולות)', icon: '🛍️', sortOrder: 2 },
          { name: 'Miscellaneous (שונות)', icon: '📦', sortOrder: 3 },
        ],
      },
    ];

    let createdCount = 0;

    // Create income categories
    for (const cat of incomeCategories) {
      await ctx.prisma.category.create({
        data: {
          householdId: ctx.householdId,
          name: cat.name,
          type: 'income',
          icon: cat.icon,
          sortOrder: cat.sortOrder,
          isSystem: true,
        },
      });
      createdCount++;
    }

    // Create expense categories with subcategories
    for (const cat of expenseCategories) {
      // Create parent category
      const parent = await ctx.prisma.category.create({
        data: {
          householdId: ctx.householdId,
          name: cat.name,
          type: 'expense',
          icon: cat.icon,
          sortOrder: cat.sortOrder,
          isSystem: true,
        },
      });
      createdCount++;

      // Create subcategories
      for (const subcat of cat.subcategories) {
        await ctx.prisma.category.create({
          data: {
            householdId: ctx.householdId,
            name: subcat.name,
            type: 'expense',
            parentCategoryId: parent.id,
            icon: subcat.icon,
            sortOrder: subcat.sortOrder,
            isSystem: true,
          },
        });
        createdCount++;
      }
    }

    return {
      success: true,
      message: `Created ${createdCount} default categories`,
      categoriesCreated: createdCount,
    };
  }),

  /**
   * Migrate existing categories to new schema
   * Replaces all existing categories with the new bilingual structure
   */
  migrateToNewSchema: protectedProcedure.mutation(async ({ ctx }) => {
    // Category mapping for smart migration
    const categoryMapping: Record<string, string> = {
      משכורת: 'Salary (משכורת)',
      Salary: 'Salary (משכורת)',
      'Salary (משכורת)': 'Salary (משכורת)',
      פרילנס: 'Freelance / Side Jobs (עבודות צד/פרילנס)',
      Freelance: 'Freelance / Side Jobs (עבודות צד/פרילנס)',
      'Freelance (פרילנס)': 'Freelance / Side Jobs (עבודות צד/פרילנס)',
      מתנות: 'Gifts & Transfers (מתנות והעברות)',
      Gifts: 'Gifts & Transfers (מתנות והעברות)',
      'Gifts (מתנות)': 'Gifts & Transfers (מתנות והעברות)',
      'הכנסה אחרת': 'Other Income (הכנסה אחרת)',
      'Other Income': 'Other Income (הכנסה אחרת)',
      'Other Income (הכנסה אחרת)': 'Other Income (הכנסה אחרת)',
      'שכר דירה': 'Rent / Mortgage (שכר דירה / משכנתא)',
      Rent: 'Rent / Mortgage (שכר דירה / משכנתא)',
      'Rent (שכר דירה)': 'Rent / Mortgage (שכר דירה / משכנתא)',
      חשמל: 'Electricity (חשמל)',
      Electricity: 'Electricity (חשמל)',
      'Electricity (חשמל)': 'Electricity (חשמל)',
      מכולת: 'Supermarket (סופרמרקט)',
      Groceries: 'Supermarket (סופרמרקט)',
      'Groceries (מכולת)': 'Supermarket (סופרמרקט)',
      מסעדות: 'Restaurants (מסעדות)',
      Restaurants: 'Restaurants (מסעדות)',
      'Restaurants (מסעדות)': 'Restaurants (מסעדות)',
      תחבורה: 'Transportation (תחבורה)',
      Transportation: 'Transportation (תחבורה)',
      'Transportation (תחבורה)': 'Transportation (תחבורה)',
      בילויים: 'Entertainment (בידור)',
      Entertainment: 'Entertainment (בידור)',
      'Entertainment (בילויים)': 'Entertainment (בידור)',
      ביטוחים: 'Insurance (ביטוחים)',
      Insurance: 'Insurance (ביטוחים)',
      אחר: 'Miscellaneous (שונות)',
      Other: 'Miscellaneous (שונות)',
      'Other (אחר)': 'Miscellaneous (שונות)',
    };

    // Get all existing categories
    const oldCategories = await ctx.prisma.category.findMany({
      where: { householdId: ctx.householdId },
    });

    if (oldCategories.length === 0) {
      return {
        success: false,
        message: 'No categories to migrate',
        stats: { oldCategories: 0, newCategories: 0, transactionsUpdated: 0 },
      };
    }

    // Create new categories (reuse seedDefaults logic)
    const incomeCategories = [
      { name: 'Salary (משכורת)', icon: '💼', sortOrder: 1 },
      { name: 'Freelance / Side Jobs (עבודות צד/פרילנס)', icon: '💻', sortOrder: 2 },
      { name: 'Government Benefits (קצבאות והטבות)', icon: '🏛️', sortOrder: 3 },
      { name: 'Refunds & Reimbursements (החזרי כספים)', icon: '↩️', sortOrder: 4 },
      { name: 'Investments & Interest (השקעות וריבית)', icon: '📈', sortOrder: 5 },
      { name: 'Gifts & Transfers (מתנות והעברות)', icon: '🎁', sortOrder: 6 },
      { name: 'Other Income (הכנסה אחרת)', icon: '💰', sortOrder: 7 },
    ];

    const expenseCategories = [
      {
        name: 'Housing (דיור)',
        icon: '🏠',
        sortOrder: 1,
        subcategories: [
          { name: 'Rent / Mortgage (שכר דירה / משכנתא)', icon: '🏘️', sortOrder: 1 },
          { name: 'Arnona (ארנונה)', icon: '🏛️', sortOrder: 2 },
          { name: 'Building Fee (ועד בית)', icon: '🏢', sortOrder: 3 },
          { name: 'Repairs & Maintenance (תיקונים ותחזוקה)', icon: '🔧', sortOrder: 4 },
          { name: 'Home Insurance (ביטוח דירה)', icon: '🛡️', sortOrder: 5 },
        ],
      },
      {
        name: 'Utilities (חשמל ומים)',
        icon: '💡',
        sortOrder: 2,
        subcategories: [
          { name: 'Electricity (חשמל)', icon: '⚡', sortOrder: 1 },
          { name: 'Water (מים)', icon: '💧', sortOrder: 2 },
          { name: 'Gas (גז)', icon: '🔥', sortOrder: 3 },
          { name: 'Internet (אינטרנט)', icon: '🌐', sortOrder: 4 },
          { name: 'Cell Phones (סלולר)', icon: '📱', sortOrder: 5 },
          { name: 'TV / Streaming (טלויזיה/סטרימינג)', icon: '📺', sortOrder: 6 },
        ],
      },
      {
        name: 'Groceries & Household (מזון ומשק בית)',
        icon: '🛒',
        sortOrder: 3,
        subcategories: [
          { name: 'Supermarket (סופרמרקט)', icon: '🏪', sortOrder: 1 },
          { name: 'Household Supplies (חומרי ניקוי וציוד)', icon: '🧹', sortOrder: 2 },
          { name: 'Baby Supplies (ציוד לתינוק)', icon: '👶', sortOrder: 3 },
        ],
      },
      {
        name: 'Eating & Drinking (אוכל בחוץ)',
        icon: '🍽️',
        sortOrder: 4,
        subcategories: [
          { name: 'Restaurants (מסעדות)', icon: '🍴', sortOrder: 1 },
          { name: 'Coffee & Snacks (קפה ונשנושים)', icon: '☕', sortOrder: 2 },
          { name: 'Delivery (משלוחים)', icon: '🚚', sortOrder: 3 },
        ],
      },
      {
        name: 'Transportation (תחבורה)',
        icon: '🚗',
        sortOrder: 5,
        subcategories: [
          { name: 'Fuel (דלק)', icon: '⛽', sortOrder: 1 },
          { name: 'Public Transport (תחבורה ציבורית)', icon: '🚌', sortOrder: 2 },
          { name: 'Taxi / Ride-Share (מוניות/שיתופי נסיעות)', icon: '🚕', sortOrder: 3 },
          { name: 'Car Maintenance (טיפולים לרכב)', icon: '🔧', sortOrder: 4 },
          { name: 'Car Insurance (ביטוח רכב)', icon: '🚙', sortOrder: 5 },
          { name: 'Parking (חניה)', icon: '🅿️', sortOrder: 6 },
        ],
      },
      {
        name: 'Kids & Family (ילדים ומשפחה)',
        icon: '👨‍👩‍👧‍👦',
        sortOrder: 6,
        subcategories: [
          { name: 'Daycare (גן/מעון)', icon: '🏫', sortOrder: 1 },
          { name: 'Activities (חוגים ופעילויות)', icon: '🎨', sortOrder: 2 },
          { name: 'Clothing (בגדים)', icon: '👕', sortOrder: 3 },
          { name: 'Health / Medicines (בריאות ותרופות)', icon: '💊', sortOrder: 4 },
        ],
      },
      {
        name: 'Health & Wellness (בריאות וכושר)',
        icon: '💊',
        sortOrder: 7,
        subcategories: [
          { name: 'Health Insurance (ביטוח בריאות)', icon: '🏥', sortOrder: 1 },
          { name: 'Medicines (תרופות)', icon: '💉', sortOrder: 2 },
          { name: 'Doctor / Dentist (רופאים/שיניים)', icon: '🦷', sortOrder: 3 },
          { name: 'Gym / Sports (חדר כושר/ספורט)', icon: '💪', sortOrder: 4 },
        ],
      },
      {
        name: 'Insurance (ביטוחים)',
        icon: '🛡️',
        sortOrder: 8,
        subcategories: [
          { name: 'Life (ביטוח חיים)', icon: '❤️', sortOrder: 1 },
          { name: 'Car (ביטוח רכב)', icon: '🚗', sortOrder: 2 },
          { name: 'Home (ביטוח דירה)', icon: '🏠', sortOrder: 3 },
          { name: 'Travel (ביטוח נסיעות)', icon: '✈️', sortOrder: 4 },
        ],
      },
      {
        name: 'Education & Personal Growth (לימודים והתפתחות)',
        icon: '📚',
        sortOrder: 9,
        subcategories: [
          { name: 'Courses (קורסים)', icon: '🎓', sortOrder: 1 },
          { name: 'Books (ספרים)', icon: '📖', sortOrder: 2 },
          { name: 'Workshops (סדנאות)', icon: '🛠️', sortOrder: 3 },
        ],
      },
      {
        name: 'Financial Commitments (התחייבויות פיננסיות)',
        icon: '💳',
        sortOrder: 10,
        subcategories: [
          { name: 'Loans (הלוואות)', icon: '🏦', sortOrder: 1 },
          { name: 'Credit Card Interest (ריביות כרטיסי אשראי)', icon: '💳', sortOrder: 2 },
          { name: 'Bank Fees (עמלות בנק)', icon: '🏧', sortOrder: 3 },
        ],
      },
      {
        name: 'Subscriptions (מנויים)',
        icon: '📱',
        sortOrder: 11,
        subcategories: [
          { name: 'Software (תוכנות)', icon: '💻', sortOrder: 1 },
          { name: 'Streaming (סטרימינג)', icon: '📺', sortOrder: 2 },
          { name: 'Cloud Storage (אחסון בענן)', icon: '☁️', sortOrder: 3 },
          { name: 'Other Services (שירותים נוספים)', icon: '🔄', sortOrder: 4 },
        ],
      },
      {
        name: 'Leisure & Lifestyle (פנאי וסגנון חיים)',
        icon: '🎭',
        sortOrder: 12,
        subcategories: [
          { name: 'Hobbies (תחביבים)', icon: '🎨', sortOrder: 1 },
          { name: 'Entertainment (בידור)', icon: '🎬', sortOrder: 2 },
          { name: 'Vacations (חופשות)', icon: '🏖️', sortOrder: 3 },
          { name: 'Gifts (מתנות)', icon: '🎁', sortOrder: 4 },
        ],
      },
      {
        name: 'Pets (חיות מחמד)',
        icon: '🐕',
        sortOrder: 13,
        subcategories: [
          { name: 'Food (מזון)', icon: '🍖', sortOrder: 1 },
          { name: 'Vet (וטרינר)', icon: '🏥', sortOrder: 2 },
          { name: 'Supplies (ציוד)', icon: '🦴', sortOrder: 3 },
        ],
      },
      {
        name: 'Charity & Donations (תרומות)',
        icon: '❤️',
        sortOrder: 14,
        subcategories: [
          { name: 'Nonprofits (עמותות)', icon: '🏛️', sortOrder: 1 },
          { name: 'Community Giving (תרומות קהילה)', icon: '🤝', sortOrder: 2 },
        ],
      },
      {
        name: 'Savings & Investments (חסכונות והשקעות)',
        icon: '💰',
        sortOrder: 15,
        subcategories: [
          { name: 'Emergency Fund (קרן חירום)', icon: '🆘', sortOrder: 1 },
          { name: 'Long-term Savings (חיסכון לטווח ארוך)', icon: '📊', sortOrder: 2 },
          { name: 'Investments (השקעות)', icon: '📈', sortOrder: 3 },
        ],
      },
      {
        name: 'Unexpected / Irregular (חד-פעמי / בלתי צפוי)',
        icon: '❗',
        sortOrder: 16,
        subcategories: [
          { name: 'Repairs (תיקונים)', icon: '🔧', sortOrder: 1 },
          { name: 'One-time Purchases (רכישות גדולות)', icon: '🛍️', sortOrder: 2 },
          { name: 'Miscellaneous (שונות)', icon: '📦', sortOrder: 3 },
        ],
      },
    ];

    // Create new categories
    const newCategoryMap = new Map<string, string>();

    for (const cat of incomeCategories) {
      const created = await ctx.prisma.category.create({
        data: {
          householdId: ctx.householdId,
          name: cat.name,
          type: 'income',
          icon: cat.icon,
          sortOrder: cat.sortOrder,
          isSystem: true,
        },
      });
      newCategoryMap.set(cat.name, created.id);
    }

    for (const cat of expenseCategories) {
      const parent = await ctx.prisma.category.create({
        data: {
          householdId: ctx.householdId,
          name: cat.name,
          type: 'expense',
          icon: cat.icon,
          sortOrder: cat.sortOrder,
          isSystem: true,
        },
      });
      newCategoryMap.set(cat.name, parent.id);

      for (const subcat of cat.subcategories) {
        const created = await ctx.prisma.category.create({
          data: {
            householdId: ctx.householdId,
            name: subcat.name,
            type: 'expense',
            parentCategoryId: parent.id,
            icon: subcat.icon,
            sortOrder: subcat.sortOrder,
            isSystem: true,
          },
        });
        newCategoryMap.set(subcat.name, created.id);
      }
    }

    // Build mapping from old to new
    const idMapping = new Map<string, string>();
    for (const oldCat of oldCategories) {
      const mappedName = categoryMapping[oldCat.name];
      if (mappedName && newCategoryMap.has(mappedName)) {
        idMapping.set(oldCat.id, newCategoryMap.get(mappedName)!);
      } else {
        const fallbackId =
          oldCat.type === 'income'
            ? newCategoryMap.get('Other Income (הכנסה אחרת)')
            : newCategoryMap.get('Miscellaneous (שונות)');
        if (fallbackId) {
          idMapping.set(oldCat.id, fallbackId);
        }
      }
    }

    // Update transactions
    let transactionsUpdated = 0;
    for (const [oldId, newId] of idMapping.entries()) {
      const result = await ctx.prisma.transaction.updateMany({
        where: { householdId: ctx.householdId, categoryId: oldId },
        data: { categoryId: newId },
      });
      transactionsUpdated += result.count;
    }

    // Delete old budgets
    await ctx.prisma.budget.deleteMany({
      where: {
        householdId: ctx.householdId,
        categoryId: { in: Array.from(idMapping.keys()) },
      },
    });

    // Update category rules
    for (const [oldId, newId] of idMapping.entries()) {
      await ctx.prisma.categoryRule.updateMany({
        where: { householdId: ctx.householdId, categoryId: oldId },
        data: { categoryId: newId },
      });
    }

    // Update recurring templates
    for (const [oldId, newId] of idMapping.entries()) {
      await ctx.prisma.recurringTransactionTemplate.updateMany({
        where: { householdId: ctx.householdId, defaultCategoryId: oldId },
        data: { defaultCategoryId: newId },
      });
    }

    // Delete old categories
    await ctx.prisma.category.deleteMany({
      where: {
        householdId: ctx.householdId,
        id: { in: oldCategories.map((c) => c.id) },
      },
    });

    return {
      success: true,
      message: `Migrated ${oldCategories.length} old categories to ${newCategoryMap.size} new categories`,
      stats: {
        oldCategories: oldCategories.length,
        newCategories: newCategoryMap.size,
        transactionsUpdated,
      },
    };
  }),
});
