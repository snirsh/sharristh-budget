import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

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
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
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
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
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
          type: z.enum(['checking', 'savings', 'credit', 'cash']).optional(),
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

  /**
   * Fix account types based on bank connection provider
   * - Isracard connections -> credit accounts
   * - OneZero connections -> checking accounts
   */
  fixAccountTypes: protectedProcedure.mutation(async ({ ctx }) => {
    // Get all bank connections with their account mappings
    const allConnections = await ctx.prisma.bankConnection.findMany({
      where: {
        householdId: ctx.householdId,
      },
      select: {
        id: true,
        provider: true,
        accountMappings: true,
      },
    });

    const creditAccountIds = new Set<string>();
    const checkingAccountIds = new Set<string>();

    for (const conn of allConnections) {
      if (conn.accountMappings) {
        const mappings = JSON.parse(conn.accountMappings) as Record<string, string>;
        const accountIds = Object.values(mappings);

        if (conn.provider === 'isracard') {
          // Isracard = credit card provider
          accountIds.forEach((id) => creditAccountIds.add(id));
        } else {
          // OneZero and others = checking/bank accounts
          accountIds.forEach((id) => checkingAccountIds.add(id));
        }
      }
    }

    // Remove any overlap (if somehow an account is in both, prefer the specific provider's type)
    // Credit card takes precedence
    checkingAccountIds.forEach((id) => {
      if (creditAccountIds.has(id)) {
        checkingAccountIds.delete(id);
      }
    });

    let creditUpdated = 0;
    let checkingUpdated = 0;

    // Update credit card accounts
    if (creditAccountIds.size > 0) {
      const result = await ctx.prisma.account.updateMany({
        where: {
          id: { in: Array.from(creditAccountIds) },
          householdId: ctx.householdId,
          type: { not: 'credit' },
        },
        data: { type: 'credit' },
      });
      creditUpdated = result.count;
    }

    // Update checking accounts (fix any that were incorrectly marked as credit)
    if (checkingAccountIds.size > 0) {
      const result = await ctx.prisma.account.updateMany({
        where: {
          id: { in: Array.from(checkingAccountIds) },
          householdId: ctx.householdId,
          type: { not: 'checking' },
        },
        data: { type: 'checking' },
      });
      checkingUpdated = result.count;
    }

    return {
      creditUpdated,
      checkingUpdated,
      message: `Updated ${creditUpdated} account(s) to credit, ${checkingUpdated} account(s) to checking`,
    };
  }),
});
