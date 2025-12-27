import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { PrismaClient } from '@sfam/db';

/**
 * Context for tRPC procedures
 */
export interface Context {
  prisma: PrismaClient;
  householdId: string; // For now, assume single household (stub auth)
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

