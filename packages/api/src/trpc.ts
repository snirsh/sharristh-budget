import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { PrismaClient } from '@sfam/db';

/**
 * Session user type from auth
 */
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * Context for tRPC procedures
 */
export interface Context {
  prisma: PrismaClient;
  user: SessionUser | null;
  householdId: string | null;
}

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/**
 * Export reusable parts
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

/**
 * Create caller factory for server-side calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Middleware that enforces authentication
 */
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.householdId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in to perform this action' });
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
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(isAuthed);

