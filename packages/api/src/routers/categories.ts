import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { createCategorySchema, updateCategorySchema } from '@sharristh/domain/schemas';

export const categoriesRouter = router({
  /**
   * List all categories (optionally by type)
   */
  list: publicProcedure
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
  tree: publicProcedure.query(async ({ ctx }) => {
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
  byId: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
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
  create: publicProcedure.input(createCategorySchema).mutation(async ({ ctx, input }) => {
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
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: updateCategorySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
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
  disable: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
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
  enable: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.category.update({
      where: { id: input, householdId: ctx.householdId },
      data: { isActive: true },
    });
  }),

  /**
   * Reorder categories
   */
  reorder: publicProcedure
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
});

