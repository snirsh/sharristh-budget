#!/usr/bin/env tsx
/**
 * Migration script to replace all existing categories with the new schema
 * Maps old categories to new ones intelligently to preserve data
 *
 * Run with: pnpm --filter @sfam/db tsx scripts/migrate-to-new-categories.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Category mapping logic - maps old category names to new ones
const categoryMapping: Record<string, string> = {
  // Income mappings (English and Hebrew)
  'משכורת': 'Salary (משכורת)',
  'Salary': 'Salary (משכורת)',
  'Salary (משכורת)': 'Salary (משכורת)',
  'פרילנס': 'Freelance / Side Jobs (עבודות צד/פרילנס)',
  'Freelance': 'Freelance / Side Jobs (עבודות צד/פרילנס)',
  'Freelance (פרילנס)': 'Freelance / Side Jobs (עבודות צד/פרילנס)',
  'מתנות': 'Gifts & Transfers (מתנות והעברות)',
  'Gifts': 'Gifts & Transfers (מתנות והעברות)',
  'Gifts (מתנות)': 'Gifts & Transfers (מתנות והעברות)',
  'הכנסה אחרת': 'Other Income (הכנסה אחרת)',
  'Other Income': 'Other Income (הכנסה אחרת)',
  'Other Income (הכנסה אחרת)': 'Other Income (הכנסה אחרת)',

  // Expense mappings
  'שכר דירה': 'Rent / Mortgage (שכר דירה / משכנתא)',
  'Rent': 'Rent / Mortgage (שכר דירה / משכנתא)',
  'Rent (שכר דירה)': 'Rent / Mortgage (שכר דירה / משכנתא)',
  'חשמל': 'Electricity (חשמל)',
  'Electricity': 'Electricity (חשמל)',
  'Electricity (חשמל)': 'Electricity (חשמל)',
  'חשמל ומים': 'Utilities (חשמל ומים)',
  'Electricity & Water': 'Utilities (חשמל ומים)',
  'Electricity & Water (חשמל ומים)': 'Utilities (חשמל ומים)',
  'מים': 'Water (מים)',
  'Water': 'Water (מים)',
  'גז': 'Gas (גז)',
  'Gas': 'Gas (גז)',
  'ביטוחים': 'Insurance (ביטוחים)',
  'Insurance': 'Insurance (ביטוחים)',
  'Insurance (ביטוחים)': 'Insurance (ביטוחים)',
  'טלפון ואינטרנט': 'Internet (אינטרנט)',
  'Phone & Internet': 'Internet (אינטרנט)',
  'Phone & Internet (טלפון ואינטרנט)': 'Internet (אינטרנט)',
  'אינטרנט': 'Internet (אינטרנט)',
  'Internet': 'Internet (אינטרנט)',
  'סלולר': 'Cell Phones (סלולר)',
  'מכולת': 'Supermarket (סופרמרקט)',
  'Groceries': 'Supermarket (סופרמרקט)',
  'Groceries (מכולת)': 'Supermarket (סופרמרקט)',
  'Supermarket': 'Supermarket (סופרמרקט)',
  'מסעדות': 'Restaurants (מסעדות)',
  'Restaurants': 'Restaurants (מסעדות)',
  'Restaurants (מסעדות)': 'Restaurants (מסעדות)',
  'קפה': 'Coffee & Snacks (קפה ונשנושים)',
  'Coffee': 'Coffee & Snacks (קפה ונשנושים)',
  'תחבורה': 'Transportation (תחבורה)',
  'Transportation': 'Transportation (תחבורה)',
  'Transportation (תחבורה)': 'Transportation (תחבורה)',
  'דלק': 'Fuel (דלק)',
  'Fuel': 'Fuel (דלק)',
  'קניות': 'Miscellaneous (שונות)',
  'Shopping': 'Miscellaneous (שונות)',
  'Shopping (קניות)': 'Miscellaneous (שונות)',
  'בילויים': 'Entertainment (בידור)',
  'Entertainment': 'Entertainment (בידור)',
  'Entertainment (בילויים)': 'Entertainment (בידור)',
  'בריאות': 'Health & Wellness (בריאות וכושר)',
  'Healthcare': 'Health & Wellness (בריאות וכושר)',
  'Healthcare (בריאות)': 'Health & Wellness (בריאות וכושר)',
  'חינוך': 'Education & Personal Growth (לימודים והתפתחות)',
  'Education': 'Education & Personal Growth (לימודים והתפתחות)',
  'Education (חינוך)': 'Education & Personal Growth (לימודים והתפתחות)',
  'ספורט': 'Gym / Sports (חדר כושר/ספורט)',
  'Sports': 'Gym / Sports (חדר כושר/ספורט)',
  'Sports (ספורט)': 'Gym / Sports (חדר כושר/ספורט)',
  'חיות מחמד': 'Pets (חיות מחמד)',
  'Pets': 'Pets (חיות מחמד)',
  'Pets (חיות מחמד)': 'Pets (חיות מחמד)',
  'תיקונים': 'Repairs (תיקונים)',
  'Repairs': 'Repairs (תיקונים)',
  'Repairs (תיקונים)': 'Repairs (תיקונים)',
  'אחר': 'Miscellaneous (שונות)',
  'Other': 'Miscellaneous (שונות)',
  'Other (אחר)': 'Miscellaneous (שונות)',
};

// New category structure
const incomeCategories = [
  { name: 'Salary (משכורת)', icon: '💼', sortOrder: 1 },
  { name: 'Freelance / Side Jobs (עבודות צד/פרילנס)', icon: '💻', sortOrder: 2 },
  { name: 'Government Benefits (קצבאות והטבות)', icon: '🏛️', sortOrder: 3 },
  { name: 'Refunds & Reimbursements (החזרי כספים)', icon: '↩️', sortOrder: 4 },
  { name: 'Investments & Interest (השקעות וריבית)', icon: '📈', sortOrder: 5 },
  { name: 'Gifts & Transfers (מתנות והעברות)', icon: '🎁', sortOrder: 6 },
  { name: 'Other Income (הכנסה אחרת)', icon: '💰', sortOrder: 7 },
];

const expenseCategories = [
  {
    name: 'Housing (דיור)',
    icon: '🏠',
    sortOrder: 1,
    subcategories: [
      { name: 'Rent / Mortgage (שכר דירה / משכנתא)', icon: '🏘️', sortOrder: 1 },
      { name: 'Arnona (ארנונה)', icon: '🏛️', sortOrder: 2 },
      { name: 'Building Fee (ועד בית)', icon: '🏢', sortOrder: 3 },
      { name: 'Repairs & Maintenance (תיקונים ותחזוקה)', icon: '🔧', sortOrder: 4 },
      { name: 'Home Insurance (ביטוח דירה)', icon: '🛡️', sortOrder: 5 },
    ],
  },
  {
    name: 'Utilities (חשמל ומים)',
    icon: '💡',
    sortOrder: 2,
    subcategories: [
      { name: 'Electricity (חשמל)', icon: '⚡', sortOrder: 1 },
      { name: 'Water (מים)', icon: '💧', sortOrder: 2 },
      { name: 'Gas (גז)', icon: '🔥', sortOrder: 3 },
      { name: 'Internet (אינטרנט)', icon: '🌐', sortOrder: 4 },
      { name: 'Cell Phones (סלולר)', icon: '📱', sortOrder: 5 },
      { name: 'TV / Streaming (טלויזיה/סטרימינג)', icon: '📺', sortOrder: 6 },
    ],
  },
  {
    name: 'Groceries & Household (מזון ומשק בית)',
    icon: '🛒',
    sortOrder: 3,
    subcategories: [
      { name: 'Supermarket (סופרמרקט)', icon: '🏪', sortOrder: 1 },
      { name: 'Household Supplies (חומרי ניקוי וציוד)', icon: '🧹', sortOrder: 2 },
      { name: 'Baby Supplies (ציוד לתינוק)', icon: '👶', sortOrder: 3 },
    ],
  },
  {
    name: 'Eating & Drinking (אוכל בחוץ)',
    icon: '🍽️',
    sortOrder: 4,
    subcategories: [
      { name: 'Restaurants (מסעדות)', icon: '🍴', sortOrder: 1 },
      { name: 'Coffee & Snacks (קפה ונשנושים)', icon: '☕', sortOrder: 2 },
      { name: 'Delivery (משלוחים)', icon: '🚚', sortOrder: 3 },
    ],
  },
  {
    name: 'Transportation (תחבורה)',
    icon: '🚗',
    sortOrder: 5,
    subcategories: [
      { name: 'Fuel (דלק)', icon: '⛽', sortOrder: 1 },
      { name: 'Public Transport (תחבורה ציבורית)', icon: '🚌', sortOrder: 2 },
      { name: 'Taxi / Ride-Share (מוניות/שיתופי נסיעות)', icon: '🚕', sortOrder: 3 },
      { name: 'Car Maintenance (טיפולים לרכב)', icon: '🔧', sortOrder: 4 },
      { name: 'Car Insurance (ביטוח רכב)', icon: '🚙', sortOrder: 5 },
      { name: 'Parking (חניה)', icon: '🅿️', sortOrder: 6 },
    ],
  },
  {
    name: 'Kids & Family (ילדים ומשפחה)',
    icon: '👨‍👩‍👧‍👦',
    sortOrder: 6,
    subcategories: [
      { name: 'Daycare (גן/מעון)', icon: '🏫', sortOrder: 1 },
      { name: 'Activities (חוגים ופעילויות)', icon: '🎨', sortOrder: 2 },
      { name: 'Clothing (בגדים)', icon: '👕', sortOrder: 3 },
      { name: 'Health / Medicines (בריאות ותרופות)', icon: '💊', sortOrder: 4 },
    ],
  },
  {
    name: 'Health & Wellness (בריאות וכושר)',
    icon: '💊',
    sortOrder: 7,
    subcategories: [
      { name: 'Health Insurance (ביטוח בריאות)', icon: '🏥', sortOrder: 1 },
      { name: 'Medicines (תרופות)', icon: '💉', sortOrder: 2 },
      { name: 'Doctor / Dentist (רופאים/שיניים)', icon: '🦷', sortOrder: 3 },
      { name: 'Gym / Sports (חדר כושר/ספורט)', icon: '💪', sortOrder: 4 },
    ],
  },
  {
    name: 'Insurance (ביטוחים)',
    icon: '🛡️',
    sortOrder: 8,
    subcategories: [
      { name: 'Life (ביטוח חיים)', icon: '❤️', sortOrder: 1 },
      { name: 'Car (ביטוח רכב)', icon: '🚗', sortOrder: 2 },
      { name: 'Home (ביטוח דירה)', icon: '🏠', sortOrder: 3 },
      { name: 'Travel (ביטוח נסיעות)', icon: '✈️', sortOrder: 4 },
    ],
  },
  {
    name: 'Education & Personal Growth (לימודים והתפתחות)',
    icon: '📚',
    sortOrder: 9,
    subcategories: [
      { name: 'Courses (קורסים)', icon: '🎓', sortOrder: 1 },
      { name: 'Books (ספרים)', icon: '📖', sortOrder: 2 },
      { name: 'Workshops (סדנאות)', icon: '🛠️', sortOrder: 3 },
    ],
  },
  {
    name: 'Financial Commitments (התחייבויות פיננסיות)',
    icon: '💳',
    sortOrder: 10,
    subcategories: [
      { name: 'Loans (הלוואות)', icon: '🏦', sortOrder: 1 },
      { name: 'Credit Card Interest (ריביות כרטיסי אשראי)', icon: '💳', sortOrder: 2 },
      { name: 'Bank Fees (עמלות בנק)', icon: '🏧', sortOrder: 3 },
    ],
  },
  {
    name: 'Subscriptions (מנויים)',
    icon: '📱',
    sortOrder: 11,
    subcategories: [
      { name: 'Software (תוכנות)', icon: '💻', sortOrder: 1 },
      { name: 'Streaming (סטרימינג)', icon: '📺', sortOrder: 2 },
      { name: 'Cloud Storage (אחסון בענן)', icon: '☁️', sortOrder: 3 },
      { name: 'Other Services (שירותים נוספים)', icon: '🔄', sortOrder: 4 },
    ],
  },
  {
    name: 'Leisure & Lifestyle (פנאי וסגנון חיים)',
    icon: '🎭',
    sortOrder: 12,
    subcategories: [
      { name: 'Hobbies (תחביבים)', icon: '🎨', sortOrder: 1 },
      { name: 'Entertainment (בידור)', icon: '🎬', sortOrder: 2 },
      { name: 'Vacations (חופשות)', icon: '🏖️', sortOrder: 3 },
      { name: 'Gifts (מתנות)', icon: '🎁', sortOrder: 4 },
    ],
  },
  {
    name: 'Pets (חיות מחמד)',
    icon: '🐕',
    sortOrder: 13,
    subcategories: [
      { name: 'Food (מזון)', icon: '🍖', sortOrder: 1 },
      { name: 'Vet (וטרינר)', icon: '🏥', sortOrder: 2 },
      { name: 'Supplies (ציוד)', icon: '🦴', sortOrder: 3 },
    ],
  },
  {
    name: 'Charity & Donations (תרומות)',
    icon: '❤️',
    sortOrder: 14,
    subcategories: [
      { name: 'Nonprofits (עמותות)', icon: '🏛️', sortOrder: 1 },
      { name: 'Community Giving (תרומות קהילה)', icon: '🤝', sortOrder: 2 },
    ],
  },
  {
    name: 'Savings & Investments (חסכונות והשקעות)',
    icon: '💰',
    sortOrder: 15,
    subcategories: [
      { name: 'Emergency Fund (קרן חירום)', icon: '🆘', sortOrder: 1 },
      { name: 'Long-term Savings (חיסכון לטווח ארוך)', icon: '📊', sortOrder: 2 },
      { name: 'Investments (השקעות)', icon: '📈', sortOrder: 3 },
    ],
  },
  {
    name: 'Unexpected / Irregular (חד-פעמי / בלתי צפוי)',
    icon: '❗',
    sortOrder: 16,
    subcategories: [
      { name: 'Repairs (תיקונים)', icon: '🔧', sortOrder: 1 },
      { name: 'One-time Purchases (רכישות גדולות)', icon: '🛍️', sortOrder: 2 },
      { name: 'Miscellaneous (שונות)', icon: '📦', sortOrder: 3 },
    ],
  },
];

async function migrateHousehold(householdId: string) {
  console.log(`\n🏠 Migrating household: ${householdId}`);

  // Get all existing categories for this household
  const oldCategories = await prisma.category.findMany({
    where: { householdId },
    include: {
      transactions: { select: { id: true } },
      budgets: { select: { id: true } },
      rules: { select: { id: true } },
      recurring: { select: { id: true } },
    },
  });

  console.log(`   Found ${oldCategories.length} existing categories`);

  // Create new categories
  const newCategoryMap = new Map<string, string>(); // name -> id

  // Create income categories
  for (const cat of incomeCategories) {
    const created = await prisma.category.create({
      data: {
        householdId,
        name: cat.name,
        type: 'income',
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        isSystem: true,
      },
    });
    newCategoryMap.set(cat.name, created.id);
  }

  // Create expense categories with subcategories
  for (const cat of expenseCategories) {
    const parent = await prisma.category.create({
      data: {
        householdId,
        name: cat.name,
        type: 'expense',
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        isSystem: true,
      },
    });
    newCategoryMap.set(cat.name, parent.id);

    for (const subcat of cat.subcategories) {
      const created = await prisma.category.create({
        data: {
          householdId,
          name: subcat.name,
          type: 'expense',
          parentCategoryId: parent.id,
          icon: subcat.icon,
          sortOrder: subcat.sortOrder,
          isSystem: true,
        },
      });
      newCategoryMap.set(subcat.name, created.id);
    }
  }

  console.log(`   ✅ Created ${newCategoryMap.size} new categories`);

  // Build mapping from old category IDs to new category IDs
  const idMapping = new Map<string, string>(); // old id -> new id
  let mappedCount = 0;
  let unmappedCount = 0;

  for (const oldCat of oldCategories) {
    const mappedName = categoryMapping[oldCat.name];
    if (mappedName && newCategoryMap.has(mappedName)) {
      idMapping.set(oldCat.id, newCategoryMap.get(mappedName)!);
      mappedCount++;
      console.log(`   ✓ Mapped: "${oldCat.name}" → "${mappedName}"`);
    } else {
      // Try to find a fallback based on type
      const fallbackId = oldCat.type === 'income'
        ? newCategoryMap.get('Other Income (הכנסה אחרת)')
        : newCategoryMap.get('Miscellaneous (שונות)');

      if (fallbackId) {
        idMapping.set(oldCat.id, fallbackId);
        unmappedCount++;
        console.log(`   ⚠ Unmapped: "${oldCat.name}" → fallback to ${oldCat.type === 'income' ? 'Other Income' : 'Miscellaneous'}`);
      }
    }
  }

  console.log(`   📊 Mapping stats: ${mappedCount} mapped, ${unmappedCount} using fallback`);

  // Update transactions
  let transactionsUpdated = 0;
  for (const [oldId, newId] of idMapping.entries()) {
    const result = await prisma.transaction.updateMany({
      where: {
        householdId,
        categoryId: oldId,
      },
      data: {
        categoryId: newId,
      },
    });
    transactionsUpdated += result.count;
  }
  console.log(`   ✅ Updated ${transactionsUpdated} transactions`);

  // Update budgets - but we need to be careful about duplicates
  // Delete budgets for old categories and let users recreate them
  const budgetsDeleted = await prisma.budget.deleteMany({
    where: {
      householdId,
      categoryId: { in: Array.from(idMapping.keys()) },
    },
  });
  console.log(`   🗑️  Deleted ${budgetsDeleted.count} budgets (users can recreate with new categories)`);

  // Update category rules
  let rulesUpdated = 0;
  for (const [oldId, newId] of idMapping.entries()) {
    const result = await prisma.categoryRule.updateMany({
      where: {
        householdId,
        categoryId: oldId,
      },
      data: {
        categoryId: newId,
      },
    });
    rulesUpdated += result.count;
  }
  console.log(`   ✅ Updated ${rulesUpdated} category rules`);

  // Update recurring templates
  let recurringUpdated = 0;
  for (const [oldId, newId] of idMapping.entries()) {
    const result = await prisma.recurringTransactionTemplate.updateMany({
      where: {
        householdId,
        defaultCategoryId: oldId,
      },
      data: {
        defaultCategoryId: newId,
      },
    });
    recurringUpdated += result.count;
  }
  console.log(`   ✅ Updated ${recurringUpdated} recurring templates`);

  // Delete old categories
  const deleted = await prisma.category.deleteMany({
    where: {
      householdId,
      id: { in: oldCategories.map((c) => c.id) },
    },
  });
  console.log(`   🗑️  Deleted ${deleted.count} old categories`);

  return {
    oldCategories: oldCategories.length,
    newCategories: newCategoryMap.size,
    transactionsUpdated,
    budgetsDeleted: budgetsDeleted.count,
    rulesUpdated,
    recurringUpdated,
  };
}

async function main() {
  console.log('🔄 Starting category migration to new schema...\n');

  // Get all households
  const households = await prisma.household.findMany({
    select: { id: true, name: true },
  });

  console.log(`Found ${households.length} households to migrate\n`);

  const stats = {
    totalHouseholds: households.length,
    totalOldCategories: 0,
    totalNewCategories: 0,
    totalTransactions: 0,
    totalBudgets: 0,
    totalRules: 0,
    totalRecurring: 0,
  };

  for (const household of households) {
    try {
      const result = await migrateHousehold(household.id);
      stats.totalOldCategories += result.oldCategories;
      stats.totalNewCategories += result.newCategories;
      stats.totalTransactions += result.transactionsUpdated;
      stats.totalBudgets += result.budgetsDeleted;
      stats.totalRules += result.rulesUpdated;
      stats.totalRecurring += result.recurringUpdated;
    } catch (error) {
      console.error(`   ❌ Error migrating household ${household.id}:`, error);
    }
  }

  console.log('\n✨ Migration complete!\n');
  console.log('📊 Summary:');
  console.log(`   Households migrated: ${stats.totalHouseholds}`);
  console.log(`   Old categories removed: ${stats.totalOldCategories}`);
  console.log(`   New categories created: ${stats.totalNewCategories}`);
  console.log(`   Transactions updated: ${stats.totalTransactions}`);
  console.log(`   Budgets deleted: ${stats.totalBudgets} (recreate with new structure)`);
  console.log(`   Rules updated: ${stats.totalRules}`);
  console.log(`   Recurring templates updated: ${stats.totalRecurring}`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
