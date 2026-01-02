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
 * Get or create demo household for demo mode
 */
async function getDemoHouseholdId(): Promise<string> {
  const DEMO_USER_ID = 'demo-user';
  const DEMO_HOUSEHOLD_NAME = '🎭 Demo Household';

  // Check if demo household exists
  let household = await prisma.household.findFirst({
    where: { name: DEMO_HOUSEHOLD_NAME },
  });

  if (!household) {
    // Create demo household with demo user
    household = await prisma.household.create({
      data: {
        name: DEMO_HOUSEHOLD_NAME,
        members: {
          create: {
            userId: DEMO_USER_ID,
            role: 'owner',
          },
        },
      },
    });
  }

  return household.id;
}

/**
 * Create server-side context with authentication
 * Uses React's cache() to memoize the session lookup per request
 * In demo mode, uses a mock demo user and household
 */
const createServerContext = cache(async (): Promise<Context> => {
  // Demo mode: use mock user and demo household
  if (process.env.DEMO_MODE === 'true') {
    const householdId = await getDemoHouseholdId();

    return {
      prisma,
      user: {
        id: 'demo-user',
        email: 'demo@example.com',
        name: 'Demo User',
      },
      householdId,
    };
  }

  // Regular mode: use auth session
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
 * Cached per request to enable deduplication of tRPC calls
 */
export const serverTrpc = cache(async () => {
  const context = await createServerContext();
  return createCaller(context);
});
