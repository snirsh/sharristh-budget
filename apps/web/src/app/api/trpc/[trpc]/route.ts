import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, type Context } from '@sfam/api';
import { prisma } from '@sfam/db';
import { auth } from '@/lib/auth';

/**
 * Get user's primary household ID
 */
async function getUserHouseholdId(userId: string): Promise<string | null> {
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' }, // Get the first/primary household
    select: { householdId: true },
  });
  return membership?.householdId ?? null;
}

/**
 * Create tRPC context with authentication
 */
async function createContext(_req: Request): Promise<Context> {
  // Get session from Auth.js
  const session = await auth();
  
  if (!session?.user?.id) {
    return {
      prisma,
      user: null,
      householdId: null,
    };
  }

  // Get user's household
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
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
  });

export { handler as GET, handler as POST };

