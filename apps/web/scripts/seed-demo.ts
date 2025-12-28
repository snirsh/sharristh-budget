#!/usr/bin/env tsx
/**
 * Script to seed demo data for demo mode
 * Run with: pnpm tsx apps/web/scripts/seed-demo.ts
 */

import { PrismaClient } from '@sfam/db';

const prisma = new PrismaClient();

async function seedDemoData() {
  const DEMO_USER_ID = 'demo-user';
  const DEMO_HOUSEHOLD_NAME = '🎭 Demo Household';

  console.log('🌱 Seeding demo data...');

  // Create demo user if it doesn't exist
  let user = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
  });

  if (!user) {
    console.log('Creating demo user...');
    user = await prisma.user.create({
      data: {
        id: DEMO_USER_ID,
        email: 'demo@example.com',
        name: 'Demo User',
      },
    });
  }

  // Check if demo household exists
  let household = await prisma.household.findFirst({
    where: { name: DEMO_HOUSEHOLD_NAME },
  });

  if (!household) {
    console.log('Creating demo household...');
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
  } else {
    console.log('Demo household already exists');
  }

  // Check if already seeded
  const existingTxCount = await prisma.transaction.count({
    where: { householdId: household.id },
  });

  if (existingTxCount > 0) {
    console.log('✅ Demo data already seeded');
    return;
  }

  console.log('Creating demo categories...');
  const defaultCategories = [
    { name: 'Salary (משכורת)', type: 'income', icon: '💼', sortOrder: 1 },
    { name: 'Other Income (הכנסה אחרת)', type: 'income', icon: '💰', sortOrder: 2 },
    { name: 'Rent (שכר דירה)', type: 'expected', icon: '🏠', sortOrder: 1 },
    { name: 'Electricity (חשמל)', type: 'expected', icon: '💡', sortOrder: 2 },
    { name: 'Insurance (ביטוחים)', type: 'expected', icon: '🛡️', sortOrder: 3 },
    { name: 'Groceries (מכולת)', type: 'varying', icon: '🛒', sortOrder: 1 },
    { name: 'Restaurants (מסעדות)', type: 'varying', icon: '🍽️', sortOrder: 2 },
    { name: 'Transportation (תחבורה)', type: 'varying', icon: '🚗', sortOrder: 3 },
    { name: 'Shopping (קניות)', type: 'varying', icon: '👕', sortOrder: 4 },
    { name: 'Entertainment (בילויים)', type: 'varying', icon: '🎬', sortOrder: 5 },
  ];

  const categoryMap: Record<string, string> = {};

  for (const cat of defaultCategories) {
    const created = await prisma.category.create({
      data: {
        householdId: household.id,
        name: cat.name,
        type: cat.type as 'income' | 'expected' | 'varying',
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        isSystem: true,
      },
    });
    categoryMap[cat.name] = created.id;
  }

  console.log('Creating demo accounts...');
  const cashAccount = await prisma.account.create({
    data: {
      householdId: household.id,
      name: 'ארנק',
      type: 'cash',
      currency: 'ILS',
      balance: 2500,
    },
  });

  const checkingAccount = await prisma.account.create({
    data: {
      householdId: household.id,
      name: 'חשבון עו"ש',
      type: 'checking',
      currency: 'ILS',
      balance: 15000,
    },
  });

  const creditAccount = await prisma.account.create({
    data: {
      householdId: household.id,
      name: 'כרטיס אשראי',
      type: 'credit',
      currency: 'ILS',
      balance: -4500,
    },
  });

  console.log('Creating recurring templates...');
  const recurringTemplates = [
    {
      name: 'משכורת',
      direction: 'income',
      amount: 18000,
      categoryId: categoryMap['Salary (משכורת)'],
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 1,
    },
    {
      name: 'שכר דירה',
      direction: 'expense',
      amount: 5500,
      categoryId: categoryMap['Rent (שכר דירה)'],
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 5,
    },
    {
      name: 'חשבון חשמל',
      direction: 'expense',
      amount: 350,
      categoryId: categoryMap['Electricity (חשמל)'],
      frequency: 'monthly',
      interval: 2, // Bimonthly
      byMonthDay: 10,
      description: 'חשבון חשמל דו-חודשי',
    },
  ];

  for (const template of recurringTemplates) {
    await prisma.recurringTransactionTemplate.create({
      data: {
        householdId: household.id,
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

  console.log('Creating demo transactions...');
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
      categoryId: categoryMap['Salary (משכורת)'],
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
      categoryId: categoryMap['Rent (שכר דירה)'],
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
    categoryId: categoryMap['Electricity (חשמל)'],
  });

  transactions.push({
    accountId: checkingAccount.id,
    date: new Date(now.getFullYear(), now.getMonth(), 10),
    description: 'חברת החשמל',
    merchant: 'חברת החשמל',
    amount: 320,
    direction: 'expense',
    categoryId: categoryMap['Electricity (חשמל)'],
  });

  // Random varying expenses
  const varyingExpenses = [
    { desc: 'רמי לוי', merchant: 'רמי לוי', category: 'מכולת', min: 150, max: 450 },
    { desc: 'שופרסל', merchant: 'שופרסל', category: 'מכולת', min: 100, max: 350 },
    { desc: 'מסעדה', merchant: 'טאיזו', category: 'מסעדות', min: 120, max: 280 },
    { desc: 'קפה', merchant: 'ארומה', category: 'מסעדות', min: 35, max: 85 },
    { desc: 'דלק', merchant: 'דלק', category: 'תחבורה', min: 200, max: 350 },
    { desc: 'H&M', merchant: 'H&M', category: 'קניות', min: 150, max: 500 },
    { desc: 'סרט בקולנוע', merchant: 'יס פלאנט', category: 'בילויים', min: 80, max: 150 },
  ];

  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo--) {
    const txCount = 10 + Math.floor(Math.random() * 6);

    for (let i = 0; i < txCount; i++) {
      const expense = varyingExpenses[Math.floor(Math.random() * varyingExpenses.length)];
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

  for (const tx of transactions) {
    await prisma.transaction.create({
      data: {
        householdId: household.id,
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

  console.log('Creating categorization rules...');
  const rules = [
    { categoryId: categoryMap['Groceries (מכולת)'], type: 'merchant', pattern: 'רמי לוי' },
    { categoryId: categoryMap['Groceries (מכולת)'], type: 'merchant', pattern: 'שופרסל' },
    { categoryId: categoryMap['Restaurants (מסעדות)'], type: 'merchant', pattern: 'ארומה' },
    { categoryId: categoryMap['Transportation (תחבורה)'], type: 'merchant', pattern: 'דלק' },
    { categoryId: categoryMap['Electricity (חשמל)'], type: 'merchant', pattern: 'חברת החשמל' },
  ];

  for (const rule of rules) {
    await prisma.categoryRule.create({
      data: {
        householdId: household.id,
        categoryId: rule.categoryId!,
        type: rule.type,
        pattern: rule.pattern,
        priority: 10,
        isActive: true,
      },
    });
  }

  console.log('Creating demo budgets...');
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const budgets = [
    {
      categoryId: categoryMap['Rent (שכר דירה)'],
      plannedAmount: 5500,
      limitAmount: 5500,
      limitType: 'hard',
      alertThresholdPct: 1.0,
    },
    {
      categoryId: categoryMap['Electricity (חשמל)'],
      plannedAmount: 350,
      limitAmount: 450,
      limitType: 'soft',
      alertThresholdPct: 0.8,
    },
    {
      categoryId: categoryMap['Insurance (ביטוחים)'],
      plannedAmount: 800,
      limitAmount: null,
      limitType: null,
      alertThresholdPct: 0.9,
    },
    {
      categoryId: categoryMap['Groceries (מכולת)'],
      plannedAmount: 3000,
      limitAmount: 3500,
      limitType: 'soft',
      alertThresholdPct: 0.85,
    },
    {
      categoryId: categoryMap['Restaurants (מסעדות)'],
      plannedAmount: 800,
      limitAmount: 1000,
      limitType: 'soft',
      alertThresholdPct: 0.8,
    },
    {
      categoryId: categoryMap['Transportation (תחבורה)'],
      plannedAmount: 1200,
      limitAmount: 1500,
      limitType: 'soft',
      alertThresholdPct: 0.75,
    },
    {
      categoryId: categoryMap['Shopping (קניות)'],
      plannedAmount: 1000,
      limitAmount: 1200,
      limitType: 'soft',
      alertThresholdPct: 0.8,
    },
    {
      categoryId: categoryMap['Entertainment (בילויים)'],
      plannedAmount: 500,
      limitAmount: 700,
      limitType: 'soft',
      alertThresholdPct: 0.9,
    },
  ];

  for (const budget of budgets) {
    await prisma.budget.create({
      data: {
        householdId: household.id,
        categoryId: budget.categoryId!,
        month: currentMonth,
        plannedAmount: budget.plannedAmount,
        limitAmount: budget.limitAmount,
        limitType: budget.limitType,
        alertThresholdPct: budget.alertThresholdPct,
      },
    });
  }

  console.log(`✅ Demo data seeded successfully!`);
  console.log(`   - ${transactions.length} transactions`);
  console.log(`   - ${recurringTemplates.length} recurring templates`);
  console.log(`   - 3 accounts`);
  console.log(`   - ${defaultCategories.length} categories`);
  console.log(`   - ${rules.length} rules`);
  console.log(`   - ${budgets.length} budgets`);
}

seedDemoData()
  .catch((e) => {
    console.error('Error seeding demo data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
