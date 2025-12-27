import { appRouter, createCallerFactory, type Context } from '@sfam/api';
import { prisma } from '@sfam/db';

const createCaller = createCallerFactory(appRouter);

// Create a server-side caller with context
export const serverTrpc = createCaller({
  prisma,
  householdId: 'household-1', // Stub: single household
} satisfies Context);

