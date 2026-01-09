import type { PrismaClient } from '@sfam/db';
import { protectedProcedure, router } from '../trpc';

/**
 * Helper function to seed demo data for a specific household
 */
async function seedDemoDataForHousehold(prisma: PrismaClient, householdId: string) {
  // 1. Create demo categories
  const defaultCategories = [
    { name: 'משכורת', type: 'income', icon: '💼', sortOrder: 1 },
    { name: 'הכנסה אחרת', type: 'income', icon: '💰', sortOrder: 2 },
    { name: 'שכר דירה', type: 'expense', icon: '🏠', sortOrder: 1 },
    { name: 'חשמל', type: 'expense', icon: '💡', sortOrder: 2 },
    { name: 'ביטוחים', type: 'expense', icon: '🛡️', sortOrder: 3 },
    { name: 'מכולת', type: 'expense', icon: '🛒', sortOrder: 4 },
    { name: 'מסעדות', type: 'expense', icon: '🍽️', sortOrder: 5 },
    { name: 'תחבורה', type: 'expense', icon: '🚗', sortOrder: 6 },
    { name: 'קניות', type: 'expense', icon: '👕', sortOrder: 7 },
    { name: 'בילויים', type: 'expense', icon: '🎬', sortOrder: 8 },
  ];

  const categoryMap: Record<string, string> = {};

  for (const cat of defaultCategories) {
    const created = await prisma.category.create({
      data: {
        householdId,
        name: cat.name,
        type: cat.type as 'income' | 'expense',
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        isSystem: true,
      },
    });
    categoryMap[cat.name] = created.id;
  }

  // 2. Create demo accounts
  const cashAccount = await prisma.account.create({
    data: {
      householdId,
      name: 'ארנק',
      type: 'cash',
      currency: 'ILS',
      balance: 2500,
    },
  });

  const checkingAccount = await prisma.account.create({
    data: {
      householdId,
      name: 'חשבון עו"ש',
      type: 'checking',
      currency: 'ILS',
      balance: 15000,
    },
  });

  const creditAccount = await prisma.account.create({
    data: {
      householdId,
      name: 'כרטיס אשראי',
      type: 'credit',
      currency: 'ILS',
      balance: -4500,
    },
  });

  // 3. Create demo recurring transactions
  const recurringTemplates = [
    {
      name: 'משכורת',
      direction: 'income',
      amount: 18000,
      categoryId: categoryMap['משכורת'],
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 1,
    },
    {
      name: 'שכר דירה',
      direction: 'expense',
      amount: 5500,
      categoryId: categoryMap['שכר דירה'],
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 5,
    },
    {
      name: 'חשבון חשמל',
      direction: 'expense',
      amount: 350,
      categoryId: categoryMap['חשמל'],
      frequency: 'monthly',
      interval: 2, // Bimonthly
      byMonthDay: 10,
      description: 'חשבון חשמל דו-חודשי',
    },
  ];

  for (const template of recurringTemplates) {
    await prisma.recurringTransactionTemplate.create({
      data: {
        householdId,
        name: template.name,
        direction: template.direction,
        amount: template.amount,
        defaultCategoryId: template.categoryId,
        description: template.description,
        frequency: template.frequency,
        interval: template.interval,
        byMonthDay: template.byMonthDay,
        startDate: new Date('2025-01-01'),
        isActive: true,
      },
    });
  }

  // 4. Create sample transactions for the past 3 months
  const now = new Date();
  const transactions = [];

  // Income transactions
  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - monthsAgo);
    date.setDate(1);

    transactions.push({
      accountId: checkingAccount.id,
      date,
      description: 'משכורת חודשית',
      amount: 18000,
      direction: 'income',
      categoryId: categoryMap['משכורת'],
    });
  }

  // Rent
  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - monthsAgo);
    date.setDate(5);

    transactions.push({
      accountId: checkingAccount.id,
      date,
      description: 'שכר דירה',
      merchant: 'בעל הבית',
      amount: 5500,
      direction: 'expense',
      categoryId: categoryMap['שכר דירה'],
    });
  }

  // Electricity (bimonthly)
  transactions.push({
    accountId: checkingAccount.id,
    date: new Date(now.getFullYear(), now.getMonth() - 2, 10),
    description: 'חברת החשמל',
    merchant: 'חברת החשמל',
    amount: 380,
    direction: 'expense',
    categoryId: categoryMap['חשמל'],
  });

  transactions.push({
    accountId: checkingAccount.id,
    date: new Date(now.getFullYear(), now.getMonth(), 10),
    description: 'חברת החשמל',
    merchant: 'חברת החשמל',
    amount: 320,
    direction: 'expense',
    categoryId: categoryMap['חשמל'],
  });

  // Random expenses
  const randomExpenses = [
    { desc: 'רמי לוי', merchant: 'רמי לוי', category: 'מכולת', min: 150, max: 450 },
    { desc: 'שופרסל', merchant: 'שופרסל', category: 'מכולת', min: 100, max: 350 },
    { desc: 'מסעדה', merchant: 'טאיזו', category: 'מסעדות', min: 120, max: 280 },
    { desc: 'קפה', merchant: 'ארומה', category: 'מסעדות', min: 35, max: 85 },
    { desc: 'דלק', merchant: 'דלק', category: 'תחבורה', min: 200, max: 350 },
    { desc: 'H&M', merchant: 'H&M', category: 'קניות', min: 150, max: 500 },
    { desc: 'סרט בקולנוע', merchant: 'יס פלאנט', category: 'בילויים', min: 80, max: 150 },
  ];

  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo--) {
    // Add 10-15 random transactions per month
    const txCount = 10 + Math.floor(Math.random() * 6);

    for (let i = 0; i < txCount; i++) {
      const expense = randomExpenses[Math.floor(Math.random() * randomExpenses.length)];
      const date = new Date(now);
      date.setMonth(date.getMonth() - monthsAgo);
      date.setDate(Math.floor(Math.random() * 28) + 1);

      const amount = expense!.min + Math.floor(Math.random() * (expense!.max - expense!.min));

      transactions.push({
        accountId: Math.random() > 0.5 ? creditAccount.id : cashAccount.id,
        date,
        description: expense!.desc,
        merchant: expense!.merchant,
        amount,
        direction: 'expense',
        categoryId: categoryMap[expense!.category],
      });
    }
  }

  // Insert all transactions
  for (const tx of transactions) {
    await prisma.transaction.create({
      data: {
        householdId,
        accountId: tx.accountId,
        date: tx.date,
        description: tx.description,
        merchant: tx.merchant,
        amount: tx.amount,
        direction: tx.direction,
        categoryId: tx.categoryId,
        categorizationSource: 'manual',
        confidence: 1,
        needsReview: false,
      },
    });
  }

  // 5. Create some category rules based on the demo data
  const rules = [
    { categoryId: categoryMap['מכולת'], type: 'merchant', pattern: 'רמי לוי' },
    { categoryId: categoryMap['מכולת'], type: 'merchant', pattern: 'שופרסל' },
    { categoryId: categoryMap['מסעדות'], type: 'merchant', pattern: 'ארומה' },
    { categoryId: categoryMap['תחבורה'], type: 'merchant', pattern: 'דלק' },
    { categoryId: categoryMap['חשמל'], type: 'merchant', pattern: 'חברת החשמל' },
  ];

  for (const rule of rules) {
    await prisma.categoryRule.create({
      data: {
        householdId,
        categoryId: rule.categoryId!,
        type: rule.type,
        pattern: rule.pattern,
        priority: 10,
        isActive: true,
      },
    });
  }

  return {
    transactions: transactions.length,
    recurringTemplates: recurringTemplates.length,
    accounts: 3,
    categories: Object.keys(categoryMap).length,
    rules: rules.length,
  };
}

/**
 * Demo data router for seeding sample data
 * Useful for demos and testing without exposing real data
 */
export const demoRouter = router({
  /**
   * Seed demo data for the current household
   * Creates sample accounts, categories, transactions, and recurring templates
   */
  seedDemoData: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if household already has data
    const existingTxCount = await ctx.prisma.transaction.count({
      where: { householdId: ctx.householdId },
    });

    if (existingTxCount > 0) {
      return {
        success: false,
        message:
          'Household already has transactions. Demo data already seeded or real data exists.',
      };
    }

    const stats = await seedDemoDataForHousehold(ctx.prisma, ctx.householdId);

    return {
      success: true,
      message: `Created demo data: ${stats.transactions} transactions, ${stats.recurringTemplates} recurring templates, ${stats.rules} rules`,
      stats,
    };
  }),

  /**
   * Clear all household data (use with caution!)
   */
  clearAllData: protectedProcedure.mutation(async ({ ctx }) => {
    // Delete in order to avoid FK constraints
    await ctx.prisma.userCorrection.deleteMany({
      where: { transaction: { householdId: ctx.householdId } },
    });

    await ctx.prisma.transaction.deleteMany({
      where: { householdId: ctx.householdId },
    });

    await ctx.prisma.budget.deleteMany({
      where: { householdId: ctx.householdId },
    });

    await ctx.prisma.categoryRule.deleteMany({
      where: { householdId: ctx.householdId },
    });

    await ctx.prisma.recurringOverride.deleteMany({
      where: { template: { householdId: ctx.householdId } },
    });

    await ctx.prisma.recurringTransactionTemplate.deleteMany({
      where: { householdId: ctx.householdId },
    });

    await ctx.prisma.account.deleteMany({
      where: { householdId: ctx.householdId },
    });

    await ctx.prisma.category.deleteMany({
      where: { householdId: ctx.householdId },
    });

    await ctx.prisma.syncJob.deleteMany({
      where: { connection: { householdId: ctx.householdId } },
    });

    await ctx.prisma.bankConnection.deleteMany({
      where: { householdId: ctx.householdId },
    });

    return {
      success: true,
      message: 'All household data cleared successfully',
    };
  }),
});
