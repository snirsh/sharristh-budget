import { z } from 'zod';
import { router, protectedProcedure, middleware } from '../trpc';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

/**
 * Hash invite code for secure storage/comparison (SHA-256)
 */
function hashInviteCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Generate a cryptographically secure random invite code
 */
function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex'); // 32 characters
}

/**
 * Middleware that enforces household ownership
 */
const isHouseholdOwner = middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.householdId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in' });
  }

  // Check if user is owner of the household
  const membership = await ctx.prisma.householdMember.findFirst({
    where: {
      householdId: ctx.householdId,
      userId: ctx.user.id,
      role: 'owner',
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only household owners can perform this action',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      householdId: ctx.householdId,
    },
  });
});

/**
 * Protected procedure that requires household ownership
 */
const ownerProcedure = protectedProcedure.use(isHouseholdOwner);

export const invitesRouter = router({
  /**
   * Create a new partner invite for the household
   * Only household owners can create invites
   */
  createPartnerInvite: ownerProcedure
    .input(
      z.object({
        role: z.enum(['owner', 'member']).default('member'),
        expiresInDays: z.number().min(1).max(30).default(7),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate a cryptographically secure random code
      const plaintextCode = generateInviteCode();
      const hashedCode = hashInviteCode(plaintextCode);

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      // Create the invite in the database
      const invite = await ctx.prisma.inviteCode.create({
        data: {
          code: hashedCode,
          type: 'household',
          householdId: ctx.householdId,
          role: input.role,
          expiresAt,
          createdByUserId: ctx.user.id,
        },
        include: {
          household: {
            select: {
              name: true,
            },
          },
        },
      });

      // Return the plaintext code (only time it's ever exposed)
      return {
        id: invite.id,
        code: plaintextCode,
        role: invite.role,
        expiresAt: invite.expiresAt,
        householdName: invite.household?.name,
      };
    }),

  /**
   * List all active invites for the household
   * Only household owners can view invites
   */
  listActiveInvites: ownerProcedure.query(async ({ ctx }) => {
    const now = new Date();

    return ctx.prisma.inviteCode.findMany({
      where: {
        householdId: ctx.householdId,
        type: 'household',
        usedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
      select: {
        id: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }),

  /**
   * List all invites (including used and expired) for the household
   * Only household owners can view invites
   */
  listAllInvites: ownerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.inviteCode.findMany({
      where: {
        householdId: ctx.householdId,
        type: 'household',
      },
      select: {
        id: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        usedAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
        usedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }),

  /**
   * Revoke an unused invite
   * Only household owners can revoke invites
   */
  revokeInvite: ownerProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the invite belongs to this household and is unused
      const invite = await ctx.prisma.inviteCode.findFirst({
        where: {
          id: input.inviteId,
          householdId: ctx.householdId,
          usedAt: null,
        },
      });

      if (!invite) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invite not found or already used',
        });
      }

      // Delete the invite
      await ctx.prisma.inviteCode.delete({
        where: {
          id: input.inviteId,
        },
      });

      return { success: true };
    }),

  /**
   * Check if an invite code is valid (public procedure for registration)
   * Returns household info if valid, null if invalid
   */
  validateInvite: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const hashedCode = hashInviteCode(input.code);
      const now = new Date();

      const invite = await ctx.prisma.inviteCode.findUnique({
        where: {
          code: hashedCode,
        },
        include: {
          household: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Check if invite exists, is unused, not expired, and is a household invite
      if (
        !invite ||
        invite.type !== 'household' ||
        invite.usedAt ||
        (invite.expiresAt && invite.expiresAt < now)
      ) {
        return null;
      }

      return {
        valid: true,
        householdId: invite.householdId,
        householdName: invite.household?.name,
        role: invite.role,
      };
    }),
});
