import { appRouter, createCallerFactory, type Context } from '@sharristh/api';
import { prisma } from '@sharristh/db';

const createCaller = createCallerFactory(appRouter);

// Create a server-side caller with context
export const serverTrpc = createCaller({
  prisma,
  householdId: 'household-1', // Stub: single household
} satisfies Context);

