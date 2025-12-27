import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.userCorrection.deleteMany();
  await prisma.recurringOverride.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.recurringTransactionTemplate.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.householdMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.household.deleteMany();

  console.log('✓ Cleaned existing data');

  // Create household
  const household = await prisma.household.create({
    data: {
      id: 'household-1',
      name: 'The Sharristh Family',
    },
  });
  console.log('✓ Created household:', household.name);

  // Create users (two partners)
  const user1 = await prisma.user.create({
    data: {
      id: 'user-1',
      email: 'partner1@sfam.family',
      name: 'Alex',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      id: 'user-2',
      email: 'partner2@sfam.family',
      name: 'Jordan',
    },
  });
  console.log('✓ Created users:', user1.name, '&', user2.name);

  // Link users to household
  await prisma.householdMember.createMany({
    data: [
      { householdId: household.id, userId: user1.id, role: 'owner' },
      { householdId: household.id, userId: user2.id, role: 'member' },
    ],
  });
  console.log('✓ Linked users to household');

  // Create accounts
  const checkingAccount = await prisma.account.create({
    data: {
      id: 'account-checking',
      householdId: household.id,
      name: 'Joint Checking',
      type: 'checking',
      currency: 'ILS',
      balance: 15000,
      institutionName: 'Bank Leumi',
    },
  });

  const savingsAccount = await prisma.account.create({
    data: {
      id: 'account-savings',
      householdId: household.id,
      name: 'Emergency Fund',
      type: 'savings',
      currency: 'ILS',
      balance: 50000,
      institutionName: 'Bank Leumi',
    },
  });

  const creditCard = await prisma.account.create({
    data: {
      id: 'account-credit',
      householdId: household.id,
      name: 'Visa Credit Card',
      type: 'credit',
      currency: 'ILS',
      balance: -2500,
      institutionName: 'Cal',
    },
  });
  console.log('✓ Created accounts');

  // ========================================
  // CATEGORIES
  // ========================================

  // Income Categories
  const salaryCategory = await prisma.category.create({
    data: {
      id: 'cat-salary',
      householdId: household.id,
      name: 'Salary',
      type: 'income',
      icon: '💰',
      color: '#10b981',
      isSystem: true,
      sortOrder: 1,
    },
  });

  const rentIncomeCategory = await prisma.category.create({
    data: {
      id: 'cat-rent-income',
      householdId: household.id,
      name: 'Rent Income',
      type: 'income',
      icon: '🏠',
      color: '#059669',
      isSystem: true,
      sortOrder: 2,
    },
  });

  const fromSavingsCategory = await prisma.category.create({
    data: {
      id: 'cat-from-savings',
      householdId: household.id,
      name: 'From Savings',
      type: 'income',
      icon: '🏦',
      color: '#047857',
      isSystem: true,
      sortOrder: 3,
    },
  });

  const otherIncomeCategory = await prisma.category.create({
    data: {
      id: 'cat-other-income',
      householdId: household.id,
      name: 'Other Income',
      type: 'income',
      icon: '💵',
      color: '#065f46',
      isSystem: true,
      sortOrder: 4,
    },
  });

  // Expected Outcome - Parent Categories
  const houseExpensesParent = await prisma.category.create({
    data: {
      id: 'cat-house-expenses',
      householdId: household.id,
      name: 'House Expenses',
      type: 'expected',
      icon: '🏠',
      color: '#3b82f6',
      isSystem: true,
      sortOrder: 10,
    },
  });

  // House Expenses - Children
  const rentExpenseCategory = await prisma.category.create({
    data: {
      id: 'cat-rent-expense',
      householdId: household.id,
      name: 'Rent',
      type: 'expected',
      parentCategoryId: houseExpensesParent.id,
      icon: '🏠',
      color: '#60a5fa',
      isSystem: true,
      sortOrder: 11,
    },
  });

  const houseCommitteeCategory = await prisma.category.create({
    data: {
      id: 'cat-house-committee',
      householdId: household.id,
      name: 'House Committee',
      type: 'expected',
      parentCategoryId: houseExpensesParent.id,
      icon: '🏢',
      color: '#93c5fd',
      isSystem: true,
      sortOrder: 12,
    },
  });

  const billsCategory = await prisma.category.create({
    data: {
      id: 'cat-bills',
      householdId: household.id,
      name: 'Bills',
      type: 'expected',
      parentCategoryId: houseExpensesParent.id,
      icon: '📄',
      color: '#bfdbfe',
      isSystem: true,
      sortOrder: 13,
    },
  });

  // Other Expected Categories
  const carExpensesCategory = await prisma.category.create({
    data: {
      id: 'cat-car-expenses',
      householdId: household.id,
      name: 'Car Expenses',
      type: 'expected',
      icon: '🚗',
      color: '#8b5cf6',
      isSystem: true,
      sortOrder: 20,
    },
  });

  const supermarketCategory = await prisma.category.create({
    data: {
      id: 'cat-supermarket',
      householdId: household.id,
      name: 'Supermarket',
      type: 'expected',
      icon: '🛒',
      color: '#a855f7',
      isSystem: true,
      sortOrder: 21,
    },
  });

  const eatingOutCategory = await prisma.category.create({
    data: {
      id: 'cat-eating-out',
      householdId: household.id,
      name: 'Eating Outside',
      type: 'expected',
      icon: '🍽️',
      color: '#f59e0b',
      isSystem: true,
      sortOrder: 22,
    },
  });

  const publicTransportCategory = await prisma.category.create({
    data: {
      id: 'cat-public-transport',
      householdId: household.id,
      name: 'Public Transportation',
      type: 'expected',
      icon: '🚌',
      color: '#06b6d4',
      isSystem: true,
      sortOrder: 23,
    },
  });

  const pharmacyCategory = await prisma.category.create({
    data: {
      id: 'cat-pharmacy',
      householdId: household.id,
      name: 'Pharmacy',
      type: 'expected',
      icon: '💊',
      color: '#ec4899',
      isSystem: true,
      sortOrder: 24,
    },
  });

  // Varying Expenses
  const varyingCategory = await prisma.category.create({
    data: {
      id: 'cat-varying',
      householdId: household.id,
      name: 'Varying Expenses',
      type: 'varying',
      icon: '❓',
      color: '#6b7280',
      isSystem: true,
      sortOrder: 100,
    },
  });

  console.log('✓ Created categories');

  // ========================================
  // CATEGORY RULES
  // ========================================

  await prisma.categoryRule.createMany({
    data: [
      // Merchant rules
      { householdId: household.id, categoryId: supermarketCategory.id, type: 'merchant', pattern: 'Shufersal', priority: 10, createdFrom: 'manual' },
      { householdId: household.id, categoryId: supermarketCategory.id, type: 'merchant', pattern: 'Rami Levy', priority: 10, createdFrom: 'manual' },
      { householdId: household.id, categoryId: supermarketCategory.id, type: 'merchant', pattern: 'Victory', priority: 10, createdFrom: 'manual' },
      { householdId: household.id, categoryId: eatingOutCategory.id, type: 'merchant', pattern: 'Aroma', priority: 10, createdFrom: 'manual' },
      { householdId: household.id, categoryId: eatingOutCategory.id, type: 'merchant', pattern: 'McDonalds', priority: 10, createdFrom: 'manual' },
      { householdId: household.id, categoryId: pharmacyCategory.id, type: 'merchant', pattern: 'Super-Pharm', priority: 10, createdFrom: 'manual' },
      { householdId: household.id, categoryId: publicTransportCategory.id, type: 'merchant', pattern: 'Rav-Kav', priority: 10, createdFrom: 'manual' },
      { householdId: household.id, categoryId: carExpensesCategory.id, type: 'merchant', pattern: 'Paz', priority: 10, createdFrom: 'manual' },
      { householdId: household.id, categoryId: carExpensesCategory.id, type: 'merchant', pattern: 'Sonol', priority: 10, createdFrom: 'manual' },
      // Keyword rules
      { householdId: household.id, categoryId: billsCategory.id, type: 'keyword', pattern: 'electricity', priority: 5, createdFrom: 'manual' },
      { householdId: household.id, categoryId: billsCategory.id, type: 'keyword', pattern: 'water bill', priority: 5, createdFrom: 'manual' },
      { householdId: household.id, categoryId: billsCategory.id, type: 'keyword', pattern: 'internet', priority: 5, createdFrom: 'manual' },
      { householdId: household.id, categoryId: salaryCategory.id, type: 'keyword', pattern: 'salary', priority: 5, createdFrom: 'manual' },
      { householdId: household.id, categoryId: salaryCategory.id, type: 'keyword', pattern: 'payroll', priority: 5, createdFrom: 'manual' },
    ],
  });
  console.log('✓ Created category rules');

  // ========================================
  // RECURRING TEMPLATES
  // ========================================

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Alex's Salary - 1st of each month
  const alexSalaryTemplate = await prisma.recurringTransactionTemplate.create({
    data: {
      id: 'recurring-alex-salary',
      householdId: household.id,
      name: "Alex's Salary",
      direction: 'income',
      amount: 18000,
      defaultCategoryId: salaryCategory.id,
      description: 'Monthly salary from TechCorp',
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 1,
      startDate: new Date(currentYear, 0, 1), // Jan 1
      isActive: true,
      nextRunAt: new Date(currentYear, currentMonth + 1, 1),
    },
  });

  // Jordan's Salary - 10th of each month
  const jordanSalaryTemplate = await prisma.recurringTransactionTemplate.create({
    data: {
      id: 'recurring-jordan-salary',
      householdId: household.id,
      name: "Jordan's Salary",
      direction: 'income',
      amount: 15000,
      defaultCategoryId: salaryCategory.id,
      description: 'Monthly salary from DesignStudio',
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 10,
      startDate: new Date(currentYear, 0, 10), // Jan 10
      isActive: true,
      nextRunAt: new Date(currentYear, currentMonth + 1, 10),
    },
  });

  // Rent expense - 1st of each month
  const rentTemplate = await prisma.recurringTransactionTemplate.create({
    data: {
      id: 'recurring-rent',
      householdId: household.id,
      name: 'Monthly Rent',
      direction: 'expense',
      amount: 5500,
      defaultCategoryId: rentExpenseCategory.id,
      description: 'Apartment rent payment',
      merchant: 'Landlord',
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 1,
      startDate: new Date(currentYear, 0, 1),
      isActive: true,
      nextRunAt: new Date(currentYear, currentMonth + 1, 1),
    },
  });

  // House committee - 5th of each month
  await prisma.recurringTransactionTemplate.create({
    data: {
      id: 'recurring-vaad',
      householdId: household.id,
      name: 'House Committee',
      direction: 'expense',
      amount: 350,
      defaultCategoryId: houseCommitteeCategory.id,
      description: 'Monthly vaad bayit',
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 5,
      startDate: new Date(currentYear, 0, 5),
      isActive: true,
      nextRunAt: new Date(currentYear, currentMonth + 1, 5),
    },
  });

  // Electricity - 15th of each month
  await prisma.recurringTransactionTemplate.create({
    data: {
      id: 'recurring-electricity',
      householdId: household.id,
      name: 'Electricity Bill',
      direction: 'expense',
      amount: 450,
      defaultCategoryId: billsCategory.id,
      description: 'IEC monthly bill',
      merchant: 'Israel Electric Corporation',
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 15,
      startDate: new Date(currentYear, 0, 15),
      isActive: true,
      nextRunAt: new Date(currentYear, currentMonth + 1, 15),
    },
  });

  console.log('✓ Created recurring templates');

  // ========================================
  // BUDGETS FOR CURRENT MONTH
  // ========================================

  const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  
  await prisma.budget.createMany({
    data: [
      // Expected expenses with limits
      { householdId: household.id, categoryId: rentExpenseCategory.id, month: currentMonthStr, plannedAmount: 5500, limitAmount: 5500, limitType: 'hard', alertThresholdPct: 1.0 },
      { householdId: household.id, categoryId: houseCommitteeCategory.id, month: currentMonthStr, plannedAmount: 350, limitAmount: 400, limitType: 'soft', alertThresholdPct: 0.9 },
      { householdId: household.id, categoryId: billsCategory.id, month: currentMonthStr, plannedAmount: 800, limitAmount: 1000, limitType: 'soft', alertThresholdPct: 0.8 },
      { householdId: household.id, categoryId: carExpensesCategory.id, month: currentMonthStr, plannedAmount: 1200, limitAmount: 1500, limitType: 'soft', alertThresholdPct: 0.8 },
      { householdId: household.id, categoryId: supermarketCategory.id, month: currentMonthStr, plannedAmount: 3000, limitAmount: 3500, limitType: 'soft', alertThresholdPct: 0.8 },
      { householdId: household.id, categoryId: eatingOutCategory.id, month: currentMonthStr, plannedAmount: 1500, limitAmount: 2000, limitType: 'soft', alertThresholdPct: 0.8 },
      { householdId: household.id, categoryId: publicTransportCategory.id, month: currentMonthStr, plannedAmount: 400, limitAmount: 500, limitType: 'soft', alertThresholdPct: 0.8 },
      { householdId: household.id, categoryId: pharmacyCategory.id, month: currentMonthStr, plannedAmount: 300, limitAmount: 500, limitType: 'soft', alertThresholdPct: 0.8 },
      // Varying expenses - soft limit
      { householdId: household.id, categoryId: varyingCategory.id, month: currentMonthStr, plannedAmount: 2000, limitAmount: 3000, limitType: 'soft', alertThresholdPct: 0.7 },
    ],
  });
  console.log('✓ Created budgets for', currentMonthStr);

  // ========================================
  // TRANSACTIONS - Generate realistic history
  // ========================================

  const transactions: Array<{
    householdId: string;
    accountId: string;
    userId: string;
    categoryId: string;
    date: Date;
    description: string;
    merchant: string | null;
    amount: number;
    direction: string;
    categorizationSource: string;
    confidence: number;
    isRecurringInstance: boolean;
    recurringTemplateId: string | null;
    recurringInstanceKey: string | null;
    needsReview: boolean;
  }> = [];

  // Generate transactions for current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = now.getDate();

  // Recurring instances for current month (past dates only)
  if (today >= 1) {
    // Alex's salary
    transactions.push({
      householdId: household.id,
      accountId: checkingAccount.id,
      userId: user1.id,
      categoryId: salaryCategory.id,
      date: new Date(currentYear, currentMonth, 1),
      description: "Alex's Salary - TechCorp",
      merchant: 'TechCorp Ltd',
      amount: 18000,
      direction: 'income',
      categorizationSource: 'manual',
      confidence: 1,
      isRecurringInstance: true,
      recurringTemplateId: alexSalaryTemplate.id,
      recurringInstanceKey: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
      needsReview: false,
    });

    // Rent payment
    transactions.push({
      householdId: household.id,
      accountId: checkingAccount.id,
      userId: user1.id,
      categoryId: rentExpenseCategory.id,
      date: new Date(currentYear, currentMonth, 1),
      description: 'Monthly Rent Payment',
      merchant: 'Landlord',
      amount: 5500,
      direction: 'expense',
      categorizationSource: 'manual',
      confidence: 1,
      isRecurringInstance: true,
      recurringTemplateId: rentTemplate.id,
      recurringInstanceKey: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
      needsReview: false,
    });
  }

  if (today >= 10) {
    // Jordan's salary
    transactions.push({
      householdId: household.id,
      accountId: checkingAccount.id,
      userId: user2.id,
      categoryId: salaryCategory.id,
      date: new Date(currentYear, currentMonth, 10),
      description: "Jordan's Salary - DesignStudio",
      merchant: 'DesignStudio Inc',
      amount: 15000,
      direction: 'income',
      categorizationSource: 'manual',
      confidence: 1,
      isRecurringInstance: true,
      recurringTemplateId: jordanSalaryTemplate.id,
      recurringInstanceKey: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-10`,
      needsReview: false,
    });
  }

  // Generate varied expense transactions throughout the month
  const expensePatterns = [
    { categoryId: supermarketCategory.id, merchants: ['Shufersal', 'Rami Levy', 'Victory'], minAmount: 150, maxAmount: 600, frequency: 3 },
    { categoryId: eatingOutCategory.id, merchants: ['Aroma', 'McDonalds', 'Cafe Cafe', 'Moses'], minAmount: 50, maxAmount: 200, frequency: 4 },
    { categoryId: carExpensesCategory.id, merchants: ['Paz Gas Station', 'Sonol', 'Delek'], minAmount: 200, maxAmount: 400, frequency: 2 },
    { categoryId: publicTransportCategory.id, merchants: ['Rav-Kav Charge', 'Israel Railways'], minAmount: 20, maxAmount: 100, frequency: 5 },
    { categoryId: pharmacyCategory.id, merchants: ['Super-Pharm', 'Be Pharm'], minAmount: 30, maxAmount: 200, frequency: 1 },
    { categoryId: varyingCategory.id, merchants: ['Amazon', 'AliExpress', 'Local Shop', null], minAmount: 50, maxAmount: 500, frequency: 2 },
  ];

  let transactionDay = 2;
  for (const pattern of expensePatterns) {
    for (let i = 0; i < pattern.frequency && transactionDay <= Math.min(today, daysInMonth - 1); i++) {
      const merchant = pattern.merchants[Math.floor(Math.random() * pattern.merchants.length)];
      const amount = Math.floor(Math.random() * (pattern.maxAmount - pattern.minAmount) + pattern.minAmount);
      const user = Math.random() > 0.5 ? user1 : user2;

      transactions.push({
        householdId: household.id,
        accountId: creditCard.id,
        userId: user.id,
        categoryId: pattern.categoryId,
        date: new Date(currentYear, currentMonth, transactionDay),
        description: merchant || 'Purchase',
        merchant: merchant,
        amount,
        direction: 'expense',
        categorizationSource: merchant ? 'rule_merchant' : 'fallback',
        confidence: merchant ? 0.95 : 0.5,
        isRecurringInstance: false,
        recurringTemplateId: null,
        recurringInstanceKey: null,
        needsReview: pattern.categoryId === varyingCategory.id,
      });

      transactionDay += 1 + Math.floor(Math.random() * 2);
    }
  }

  // Add some transactions with soft limit exceeded (for demo purposes)
  // Eating out - approaching limit
  transactions.push({
    householdId: household.id,
    accountId: creditCard.id,
    userId: user1.id,
    categoryId: eatingOutCategory.id,
    date: new Date(currentYear, currentMonth, Math.min(today, 20)),
    description: 'Fancy Restaurant Dinner',
    merchant: 'The Chef Table',
    amount: 850,
    direction: 'expense',
    categorizationSource: 'manual',
    confidence: 1,
    isRecurringInstance: false,
    recurringTemplateId: null,
    recurringInstanceKey: null,
    needsReview: false,
  });

  // Create all transactions
  for (const tx of transactions) {
    await prisma.transaction.create({ data: tx });
  }
  console.log(`✓ Created ${transactions.length} transactions`);

  // ========================================
  // SUMMARY
  // ========================================

  const totalIncome = transactions
    .filter((t) => t.direction === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.direction === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  console.log('\n📊 Seed Summary:');
  console.log(`   Household: ${household.name}`);
  console.log(`   Users: ${user1.name}, ${user2.name}`);
  console.log(`   Accounts: 3 (Checking, Savings, Credit)`);
  console.log(`   Categories: 13`);
  console.log(`   Rules: 15`);
  console.log(`   Recurring Templates: 5`);
  console.log(`   Transactions: ${transactions.length}`);
  console.log(`   Total Income: ₪${totalIncome.toLocaleString()}`);
  console.log(`   Total Expenses: ₪${totalExpenses.toLocaleString()}`);
  console.log(`   Net: ₪${(totalIncome - totalExpenses).toLocaleString()}`);

  console.log('\n✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

