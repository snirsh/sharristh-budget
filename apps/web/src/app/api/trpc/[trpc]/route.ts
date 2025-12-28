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
 * Create tRPC context with authentication
 * In demo mode, uses a mock demo user and household
 */
async function createContext(_req: Request): Promise<Context> {
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

