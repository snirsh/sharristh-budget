import { PrismaClient } from '@sfam/db';

/**
 * Test helper utilities for API integration tests
 */

// Create a test Prisma client (you can use an in-memory SQLite for tests)
export const createTestPrismaClient = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || 'file:./test.db',
      },
    },
  });
};

/**
 * Create a test tRPC context
 */
export const createTestContext = (opts: {
  prisma: PrismaClient;
  householdId: string;
  userId: string;
}) => {
  const user = {
    id: opts.userId,
    email: 'test@example.com',
    name: 'Test User',
  };
  return {
    prisma: opts.prisma,
    householdId: opts.householdId,
    userId: opts.userId,
    user,
    session: {
      user,
    },
  };
};

/**
 * Clean up database after tests
 */
export const cleanupDatabase = async (prisma: PrismaClient) => {
  // Delete in reverse order of dependencies
  await prisma.userCorrection.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.household.deleteMany();
  await prisma.user.deleteMany();
};

/**
 * Create test fixtures
 */
export const createTestFixtures = async (prisma: PrismaClient) => {
  // Create test household
  const household = await prisma.household.create({
    data: {
      id: 'test-household-1',
      name: 'Test Household',
    },
  });

  // Create test user
  const user = await prisma.user.create({
    data: {
      id: 'test-user-1',
      email: 'test@example.com',
      name: 'Test User',
    },
  });

  // Create household membership
  await prisma.householdMember.create({
    data: {
      householdId: household.id,
      userId: user.id,
      role: 'owner',
    },
  });

  // Create test account
  const account = await prisma.account.create({
    data: {
      id: 'test-account-1',
      householdId: household.id,
      name: 'Test Account',
      type: 'checking',
      balance: 1000,
    },
  });

  // Create test categories
  const incomeCategory = await prisma.category.create({
    data: {
      id: 'test-cat-income',
      householdId: household.id,
      name: 'Salary',
      icon: '💰',
      color: '#10b981',
      type: 'income',
      sortOrder: 1,
    },
  });

  const expenseCategory = await prisma.category.create({
    data: {
      id: 'test-cat-expense',
      householdId: household.id,
      name: 'Groceries',
      icon: '🛒',
      color: '#3b82f6',
      type: 'expense',
      sortOrder: 2,
    },
  });

  const varyingCategory = await prisma.category.create({
    data: {
      id: 'test-cat-varying',
      householdId: household.id,
      name: 'Other',
      icon: '❓',
      color: '#6b7280',
      type: 'expense',
      sortOrder: 3,
    },
  });

  // Create test rule
  const rule = await prisma.categoryRule.create({
    data: {
      id: 'test-rule-1',
      householdId: household.id,
      categoryId: expenseCategory.id,
      type: 'merchant',
      pattern: 'Shufersal',
      priority: 10,
      isActive: true,
    },
  });

  return {
    household,
    user,
    account,
    categories: { incomeCategory, expenseCategory, varyingCategory },
    rule,
  };
};

/**
 * Create another household for testing cross-household isolation
 */
export const createSecondTestHousehold = async (prisma: PrismaClient) => {
  const household = await prisma.household.create({
    data: {
      id: 'test-household-2',
      name: 'Second Test Household',
    },
  });

  const user = await prisma.user.create({
    data: {
      id: 'test-user-2',
      email: 'test2@example.com',
      name: 'Test User 2',
    },
  });

  // Create household membership
  await prisma.householdMember.create({
    data: {
      householdId: household.id,
      userId: user.id,
      role: 'owner',
    },
  });

  const account = await prisma.account.create({
    data: {
      id: 'test-account-2',
      householdId: household.id,
      name: 'Second Test Account',
      type: 'checking',
      balance: 2000,
    },
  });

  const category = await prisma.category.create({
    data: {
      id: 'test-cat-2',
      householdId: household.id,
      name: 'Category 2',
      icon: '🏠',
      color: '#8b5cf6',
      type: 'expense',
      sortOrder: 1,
    },
  });

  return { household, user, account, category };
};
