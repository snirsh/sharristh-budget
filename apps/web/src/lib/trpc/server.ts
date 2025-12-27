import { appRouter, createCallerFactory, type Context } from '@sfam/api';
import { prisma } from '@sfam/db';
import { auth } from '@/lib/auth';
import { cache } from 'react';

const createCaller = createCallerFactory(appRouter);

/**
 * Get user's primary household ID
 */
async function getUserHouseholdId(userId: string): Promise<string | null> {
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { householdId: true },
  });
  return membership?.householdId ?? null;
}

/**
 * Create server-side context with authentication
 * Uses React's cache() to memoize the session lookup per request
 */
const createServerContext = cache(async (): Promise<Context> => {
  const session = await auth();
  
  if (!session?.user?.id) {
    return {
      prisma,
      user: null,
      householdId: null,
    };
  }

  const householdId = await getUserHouseholdId(session.user.id);

  return {
    prisma,
    user: {
      id: session.user.id,
      email: session.user.email!,
      name: session.user.name,
    },
    householdId,
  };
});

/**
 * Server-side tRPC caller for React Server Components
 * Automatically includes authentication context
 */
export const serverTrpc = async () => {
  const context = await createServerContext();
  return createCaller(context);
};
