#!/usr/bin/env tsx
/**
 * Script to migrate existing Hebrew categories to bilingual format
 * Run with: pnpm --filter @sfam/db tsx scripts/migrate-categories-to-bilingual.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Translation map from Hebrew to bilingual format
const translations: Record<string, string> = {
  // Income
  משכורת: 'Salary (משכורת)',
  פרילנס: 'Freelance (פרילנס)',
  מתנות: 'Gifts (מתנות)',
  'הכנסה אחרת': 'Other Income (הכנסה אחרת)',

  // Expected (Fixed) expenses
  'שכר דירה': 'Rent (שכר דירה)',
  'חשמל ומים': 'Electricity & Water (חשמל ומים)',
  חשמל: 'Electricity (חשמל)',
  ביטוחים: 'Insurance (ביטוחים)',
  'טלפון ואינטרנט': 'Phone & Internet (טלפון ואינטרנט)',
  'החזר הלוואה': 'Loan Repayment (החזר הלוואה)',
  'מס הכנסה': 'Income Tax (מס הכנסה)',
  'ביטוח לאומי': 'National Insurance (ביטוח לאומי)',

  // Varying expenses
  מכולת: 'Groceries (מכולת)',
  מסעדות: 'Restaurants (מסעדות)',
  תחבורה: 'Transportation (תחבורה)',
  קניות: 'Shopping (קניות)',
  בילויים: 'Entertainment (בילויים)',
  בריאות: 'Healthcare (בריאות)',
  חינוך: 'Education (חינוך)',
  ספורט: 'Sports (ספורט)',
  טיפוח: 'Beauty & Care (טיפוח)',
  'מתנות ואירועים': 'Gifts & Events (מתנות ואירועים)',
  'חיות מחמד': 'Pets (חיות מחמד)',
  תיקונים: 'Repairs (תיקונים)',
  אחר: 'Other (אחר)',
};

async function migrateCategories() {
  console.log('🔄 Starting category migration to bilingual format...');

  let updatedCount = 0;
  let skippedCount = 0;

  // Get all categories
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  console.log(`📋 Found ${categories.length} categories`);

  for (const category of categories) {
    const bilingualName = translations[category.name];

    if (bilingualName) {
      // Update to bilingual format
      await prisma.category.update({
        where: { id: category.id },
        data: { name: bilingualName },
      });
      console.log(`✅ Updated: "${category.name}" → "${bilingualName}"`);
      updatedCount++;
    } else if (category.name.match(/\(.+\)/)) {
      // Already bilingual (has parentheses)
      console.log(`⏭️  Skipped (already bilingual): "${category.name}"`);
      skippedCount++;
    } else {
      // Unknown category, skip
      console.log(`⚠️  Skipped (no translation): "${category.name}"`);
      skippedCount++;
    }
  }

  console.log(`\n✨ Migration complete!`);
  console.log(`   - Updated: ${updatedCount} categories`);
  console.log(`   - Skipped: ${skippedCount} categories`);
}

migrateCategories()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
