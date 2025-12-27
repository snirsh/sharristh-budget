import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, type Context } from '@sharristh/api';
import { prisma } from '@sharristh/db';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: (): Context => ({
      prisma,
      householdId: 'household-1', // Stub: single household for now
    }),
  });

export { handler as GET, handler as POST };

