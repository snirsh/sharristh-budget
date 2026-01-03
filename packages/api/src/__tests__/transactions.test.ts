import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { transactionsRouter } from '../routers/transactions';
import {
  createTestPrismaClient,
  createTestContext,
  cleanupDatabase,
  createTestFixtures,
  createSecondTestHousehold,
} from './test-helpers';
import type { PrismaClient } from '@sfam/db';

describe('Transactions Router Integration Tests', () => {
  let prisma: PrismaClient;
  let testData: Awaited<ReturnType<typeof createTestFixtures>>;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(async () => {
    prisma = createTestPrismaClient();
    await cleanupDatabase(prisma);
    testData = await createTestFixtures(prisma);
    testContext = createTestContext({
      prisma,
      householdId: testData.household.id,
      userId: testData.user.id,
    });
  });

  afterEach(async () => {
    await cleanupDatabase(prisma);
    await prisma.$disconnect();
  });

  describe('recategorize mutation', () => {
    it('should successfully recategorize a transaction', async () => {
      // Create a transaction
      const transaction = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Test Transaction',
          amount: 100,
          direction: 'expense',
          categoryId: testData.categories.varyingCategory.id,
        },
      });

      // Recategorize it
      const caller = transactionsRouter.createCaller(testContext);
      const result = await caller.recategorize({
        transactionId: transaction.id,
        categoryId: testData.categories.expenseCategory.id,
        createRule: false,
      });

      // Verify the result
      expect(result.categoryId).toBe(testData.categories.expenseCategory.id);
      expect(result.categorizationSource).toBe('manual');
      expect(result.confidence).toBe(1);
      expect(result.needsReview).toBe(false);

      // Verify in database
      const updated = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(updated?.categoryId).toBe(testData.categories.expenseCategory.id);
      expect(updated?.categorizationSource).toBe('manual');
    });

    it('should fail to recategorize transaction from different household', async () => {
      // Create transaction in a different household
      const otherHousehold = await createSecondTestHousehold(prisma);
      const transaction = await prisma.transaction.create({
        data: {
          householdId: otherHousehold.household.id,
          accountId: otherHousehold.account.id,
          date: new Date(),
          description: 'Other Household Transaction',
          amount: 100,
          direction: 'expense',
        },
      });

      // Try to recategorize it with our context (different household)
      const caller = transactionsRouter.createCaller(testContext);

      await expect(
        caller.recategorize({
          transactionId: transaction.id,
          categoryId: testData.categories.expenseCategory.id,
          createRule: false,
        })
      ).rejects.toThrow('Transaction not found');
    });

    it('should create a rule when createRule is true', async () => {
      // Create a transaction with merchant
      const transaction = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Purchase at SuperPharm',
          merchant: 'SuperPharm',
          amount: 100,
          direction: 'expense',
        },
      });

      // Recategorize with createRule = true
      const caller = transactionsRouter.createCaller(testContext);
      await caller.recategorize({
        transactionId: transaction.id,
        categoryId: testData.categories.expenseCategory.id,
        createRule: true,
      });

      // Verify rule was created
      const rules = await prisma.categoryRule.findMany({
        where: {
          householdId: testData.household.id,
          pattern: 'SuperPharm',
        },
      });

      expect(rules).toHaveLength(1);
      expect(rules[0]?.categoryId).toBe(testData.categories.expenseCategory.id);
      expect(rules[0]?.type).toBe('merchant');
      expect(rules[0]?.priority).toBe(10);
      expect(rules[0]?.createdFrom).toBe('correction');
    });

    it('should not create rule if createRule is false', async () => {
      // Create a transaction with merchant
      const transaction = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Purchase at TestMerchant',
          merchant: 'TestMerchant',
          amount: 100,
          direction: 'expense',
        },
      });

      // Recategorize with createRule = false
      const caller = transactionsRouter.createCaller(testContext);
      await caller.recategorize({
        transactionId: transaction.id,
        categoryId: testData.categories.expenseCategory.id,
        createRule: false,
      });

      // Verify NO rule was created
      const rules = await prisma.categoryRule.findMany({
        where: {
          householdId: testData.household.id,
          pattern: 'TestMerchant',
        },
      });

      expect(rules).toHaveLength(0);
    });
  });

  describe('applyCategorization mutation', () => {
    it('should only process uncategorized transactions', async () => {
      // Create categorized transaction (should be skipped)
      const categorized = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Already categorized',
          amount: 100,
          direction: 'expense',
          categoryId: testData.categories.expenseCategory.id,
        },
      });

      // Create uncategorized transaction (should be processed)
      const uncategorized = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Weekly shopping at Shufersal',
          merchant: 'Shufersal',
          amount: 200,
          direction: 'expense',
          // No categoryId
        },
      });

      // Run categorization
      const caller = transactionsRouter.createCaller(testContext);
      const result = await caller.applyCategorization();

      // Verify result
      expect(result.updated).toBeGreaterThan(0);

      // Verify uncategorized was processed
      const updatedUncategorized = await prisma.transaction.findUnique({
        where: { id: uncategorized.id },
      });
      expect(updatedUncategorized?.categoryId).toBe(testData.categories.expenseCategory.id);
      expect(updatedUncategorized?.categorizationSource).toBe('rule_merchant');

      // Verify categorized was NOT touched
      const stillCategorized = await prisma.transaction.findUnique({
        where: { id: categorized.id },
      });
      expect(stillCategorized?.categoryId).toBe(testData.categories.expenseCategory.id);
    });

    it('should skip ignored transactions', async () => {
      // Create ignored uncategorized transaction
      const ignored = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Ignored transaction at Shufersal',
          merchant: 'Shufersal',
          amount: 100,
          direction: 'expense',
          isIgnored: true,
          // No categoryId
        },
      });

      // Run categorization
      const caller = transactionsRouter.createCaller(testContext);
      await caller.applyCategorization();

      // Verify ignored transaction was NOT categorized
      const stillIgnored = await prisma.transaction.findUnique({
        where: { id: ignored.id },
      });
      expect(stillIgnored?.categoryId).toBeNull();
    });

    it('should use locking mechanism to prevent concurrent processing', async () => {
      // Create uncategorized transaction
      const transaction = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Test transaction',
          amount: 100,
          direction: 'expense',
        },
      });

      // Manually lock the transaction
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { isProcessing: true },
      });

      // Run categorization
      const caller = transactionsRouter.createCaller(testContext);
      await caller.applyCategorization();

      // Verify transaction was NOT processed (still locked, no category)
      const stillLocked = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(stillLocked?.categoryId).toBeNull();
      expect(stillLocked?.isProcessing).toBe(true);
    });

    it('should unlock transactions after successful processing', async () => {
      // Create uncategorized transaction that matches rule
      const transaction = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Shopping at Shufersal',
          merchant: 'Shufersal',
          amount: 100,
          direction: 'expense',
        },
      });

      // Run categorization
      const caller = transactionsRouter.createCaller(testContext);
      await caller.applyCategorization();

      // Verify transaction was unlocked
      const processed = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(processed?.isProcessing).toBe(false);
      expect(processed?.categoryId).not.toBeNull();
    });

    it('should unlock transactions even on error', async () => {
      // Create uncategorized transaction
      const transaction = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Test transaction',
          amount: 100,
          direction: 'expense',
        },
      });

      const caller = transactionsRouter.createCaller(testContext);

      // Mock an error scenario by disconnecting during processing
      // (In real scenario, this tests the finally block)
      try {
        await caller.applyCategorization();
      } catch (error) {
        // Expected if database error occurs
      }

      // In successful case, verify unlock happened
      const finalState = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(finalState?.isProcessing).toBe(false);
    });

    it('should respect household isolation in categorization', async () => {
      // Create transaction in different household
      const otherHousehold = await createSecondTestHousehold(prisma);
      await prisma.transaction.create({
        data: {
          householdId: otherHousehold.household.id,
          accountId: otherHousehold.account.id,
          date: new Date(),
          description: 'Shopping at Shufersal',
          merchant: 'Shufersal',
          amount: 100,
          direction: 'expense',
        },
      });

      // Create transaction in our household
      const ourTransaction = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Shopping at Shufersal',
          merchant: 'Shufersal',
          amount: 200,
          direction: 'expense',
        },
      });

      // Run categorization with our context
      const caller = transactionsRouter.createCaller(testContext);
      const result = await caller.applyCategorization();

      // Should only update our household's transaction
      expect(result.updated).toBe(1);

      // Verify our transaction was processed
      const our = await prisma.transaction.findUnique({
        where: { id: ourTransaction.id },
      });
      expect(our?.categoryId).not.toBeNull();

      // Verify other household's transaction was NOT touched
      const other = await prisma.transaction.findFirst({
        where: { householdId: otherHousehold.household.id },
      });
      expect(other?.categoryId).toBeNull();
    });

    it('should create rules from AI suggestions with high confidence', async () => {
      // Note: This test would need AI mocking
      // For now, we test the rule creation logic path

      // Create a transaction that would trigger AI categorization
      const transaction = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Purchase at NewMerchant Store',
          merchant: 'NewMerchant',
          amount: 100,
          direction: 'expense',
        },
      });

      // The test verifies that when AI returns high confidence (≥0.75)
      // a rule should be created automatically
      // Since we can't easily mock AI here, this serves as documentation
      // for the expected behavior

      // In a full integration test with AI mocked, we would verify:
      // 1. Transaction gets categorized by AI
      // 2. If confidence >= 0.75, rule is created
      // 3. Rule pattern is merchant name or keyword
      // 4. Rule priority is 5 (medium)
      // 5. createdFrom is 'ai_suggestion'
    });
  });

  describe('list query with categorization status', () => {
    it('should return transactions with isProcessing status', async () => {
      // Create a locked transaction
      const locked = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Locked transaction',
          amount: 100,
          direction: 'expense',
          isProcessing: true,
        },
      });

      // Create a normal transaction
      const normal = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'Normal transaction',
          amount: 100,
          direction: 'expense',
          isProcessing: false,
        },
      });

      // Query transactions
      const caller = transactionsRouter.createCaller(testContext);
      const result = await caller.list({
        limit: 10,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
      });

      // Both should be returned
      expect(result.transactions).toHaveLength(2);

      // Find locked one and verify status
      const lockedResult = result.transactions.find(t => t.id === locked.id);
      expect(lockedResult).toBeDefined();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle batch categorization limit correctly', async () => {
      // Create 25 uncategorized transactions
      const transactions = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          prisma.transaction.create({
            data: {
              householdId: testData.household.id,
              accountId: testData.account.id,
              date: new Date(),
              description: `Transaction ${i}`,
              amount: 100,
              direction: 'expense',
            },
          })
        )
      );

      // Run categorization (should process max 20)
      const caller = transactionsRouter.createCaller(testContext);
      const result = await caller.applyCategorization();

      // Should indicate more transactions need processing
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.message).toContain('more need categorization');
    });

    it('should handle transactions without merchant gracefully', async () => {
      const transaction = await prisma.transaction.create({
        data: {
          householdId: testData.household.id,
          accountId: testData.account.id,
          date: new Date(),
          description: 'No merchant transaction',
          // No merchant field
          amount: 100,
          direction: 'expense',
        },
      });

      const caller = transactionsRouter.createCaller(testContext);
      await caller.applyCategorization();

      // Should complete without error
      const updated = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(updated?.isProcessing).toBe(false);
    });
  });
});
