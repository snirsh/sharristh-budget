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
   * Fix account types for credit card providers (Isracard)
   * Updates accounts linked to credit card bank connections to have type 'credit'
   */
  fixCreditCardAccountTypes: protectedProcedure.mutation(async ({ ctx }) => {
    // Find all Isracard bank connections for this household
    const creditCardConnections = await ctx.prisma.bankConnection.findMany({
      where: {
        householdId: ctx.householdId,
        provider: 'isracard',
      },
      select: {
        id: true,
        accountMappings: true,
      },
    });

    // Collect all account IDs from account mappings
    const accountIdsToFix = new Set<string>();
    for (const conn of creditCardConnections) {
      if (conn.accountMappings) {
        const mappings = JSON.parse(conn.accountMappings) as Record<string, string>;
        Object.values(mappings).forEach(id => accountIdsToFix.add(id));
      }
    }

    // Also find accounts with externalAccountId that were auto-created by Isracard syncs
    const accountsWithExternalIds = await ctx.prisma.account.findMany({
      where: {
        householdId: ctx.householdId,
        externalAccountId: { not: null },
        type: { not: 'credit' },
      },
      select: { id: true, externalAccountId: true },
    });

    // Add accounts that have transactions from Isracard connections
    for (const account of accountsWithExternalIds) {
      accountIdsToFix.add(account.id);
    }

    if (accountIdsToFix.size === 0) {
      return { updated: 0, message: 'No accounts needed fixing' };
    }

    // Update all identified accounts to type 'credit'
    const result = await ctx.prisma.account.updateMany({
      where: {
        id: { in: Array.from(accountIdsToFix) },
        householdId: ctx.householdId,
        type: { not: 'credit' }, // Only update if not already credit
      },
      data: {
        type: 'credit',
      },
    });

    return {
      updated: result.count,
      message: `Fixed ${result.count} account(s) to credit card type`,
    };
  }),
});
