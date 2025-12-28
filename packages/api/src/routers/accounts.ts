import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const accountsRouter = router({
  /**
   * Ensure default account exists and return all accounts
   * Creates a default "Cash" account if no accounts exist
   */
  ensureDefault: protectedProcedure.mutation(async ({ ctx }) => {
    const existingAccounts = await ctx.prisma.account.findMany({
      where: {
        householdId: ctx.householdId,
        isActive: true,
      },
    });

    if (existingAccounts.length === 0) {
      await ctx.prisma.account.create({
        data: {
          householdId: ctx.householdId,
          name: 'מזומן',
          type: 'cash',
          currency: 'ILS',
          balance: 0,
        },
      });
    }

    return ctx.prisma.account.findMany({
      where: {
        householdId: ctx.householdId,
        isActive: true,
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });
  }),

  /**
   * List all accounts for the household
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.account.findMany({
      where: {
        householdId: ctx.householdId,
        isActive: true,
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });
  }),

  /**
   * Get single account by ID
   */
  byId: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.account.findUnique({
      where: {
        id: input,
        householdId: ctx.householdId,
      },
    });
  }),

  /**
   * Create a new account
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(['checking', 'savings', 'credit', 'cash']),
        currency: z.string().default('ILS'),
        balance: z.number().default(0),
        institutionName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.account.create({
        data: {
          householdId: ctx.householdId,
          name: input.name,
          type: input.type,
          currency: input.currency,
          balance: input.balance,
          institutionName: input.institutionName,
        },
      });
    }),

  /**
   * Update an account
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().min(1).optional(),
          balance: z.number().optional(),
          isActive: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.account.update({
        where: {
          id: input.id,
          householdId: ctx.householdId,
        },
        data: input.data,
      });
    }),
});
