import { describe, expect, it } from 'vitest';
import { categorizeTransaction, suggestRuleFromCorrection } from './categorization';
import type { CategoryRule, TransactionInput } from './types';

describe('categorizeTransaction', () => {
  const mockRules: CategoryRule[] = [
    {
      id: 'rule-1',
      householdId: 'h1',
      categoryId: 'cat-supermarket',
      type: 'merchant',
      pattern: 'Shufersal',
      priority: 10,
      isActive: true,
    },
    {
      id: 'rule-2',
      householdId: 'h1',
      categoryId: 'cat-bills',
      type: 'keyword',
      pattern: 'electricity',
      priority: 5,
      isActive: true,
    },
    {
      id: 'rule-3',
      householdId: 'h1',
      categoryId: 'cat-pharmacy',
      type: 'regex',
      pattern: 'pharm(acy)?',
      priority: 3,
      isActive: true,
    },
    {
      id: 'rule-4',
      householdId: 'h1',
      categoryId: 'cat-inactive',
      type: 'merchant',
      pattern: 'Inactive Merchant',
      priority: 10,
      isActive: false, // Inactive rule
    },
  ];

  it('should return manual source if category is already set', async () => {
    const tx: TransactionInput = {
      description: 'Test',
      amount: 100,
      direction: 'expense',
      categoryId: 'cat-manual',
    };

    const result = await categorizeTransaction(tx, mockRules);

    expect(result.categoryId).toBe('cat-manual');
    expect(result.source).toBe('manual');
    expect(result.confidence).toBe(1.0);
  });

  it('should match merchant rule with high confidence', async () => {
    const tx: TransactionInput = {
      description: 'Weekly groceries',
      merchant: 'Shufersal Deal',
      amount: 350,
      direction: 'expense',
    };

    const result = await categorizeTransaction(tx, mockRules);

    expect(result.categoryId).toBe('cat-supermarket');
    expect(result.source).toBe('rule_merchant');
    expect(result.confidence).toBe(0.95);
    expect(result.matchedRule?.id).toBe('rule-1');
  });

  it('should match keyword rule', async () => {
    const tx: TransactionInput = {
      description: 'Monthly electricity bill payment',
      amount: 450,
      direction: 'expense',
    };

    const result = await categorizeTransaction(tx, mockRules);

    expect(result.categoryId).toBe('cat-bills');
    expect(result.source).toBe('rule_keyword');
    expect(result.confidence).toBe(0.8);
  });

  it('should match regex rule', async () => {
    const tx: TransactionInput = {
      description: 'Super-Pharm Purchase',
      amount: 150,
      direction: 'expense',
    };

    const result = await categorizeTransaction(tx, mockRules);

    expect(result.categoryId).toBe('cat-pharmacy');
    expect(result.source).toBe('rule_regex');
    expect(result.confidence).toBe(0.75);
  });

  it('should ignore inactive rules', async () => {
    const tx: TransactionInput = {
      description: 'Purchase at Inactive Merchant',
      merchant: 'Inactive Merchant',
      amount: 100,
      direction: 'expense',
    };

    const result = await categorizeTransaction(tx, mockRules);

    // Should NOT match the inactive rule
    expect(result.categoryId).not.toBe('cat-inactive');
    expect(result.source).toBe('fallback');
  });

  it('should fallback with null categoryId for unmatched expenses (API determines actual category)', async () => {
    const tx: TransactionInput = {
      description: 'Random purchase',
      amount: 100,
      direction: 'expense',
    };

    const result = await categorizeTransaction(tx, mockRules);

    expect(result.categoryId).toBeNull();
    expect(result.source).toBe('fallback');
    expect(result.confidence).toBe(0.5);
    expect(result.reason).toContain('needs categorization');
  });

  it('should fallback with null categoryId for unmatched income (API determines actual category)', async () => {
    const tx: TransactionInput = {
      description: 'Random income',
      amount: 1000,
      direction: 'income',
    };

    const result = await categorizeTransaction(tx, mockRules);

    expect(result.categoryId).toBeNull();
    expect(result.source).toBe('fallback');
    expect(result.confidence).toBe(0.5);
    expect(result.reason).toContain('income category');
  });

  it('should prioritize merchant rules over keyword rules', async () => {
    const tx: TransactionInput = {
      description: 'Shufersal electricity dept',
      merchant: 'Shufersal',
      amount: 100,
      direction: 'expense',
    };

    const result = await categorizeTransaction(tx, mockRules);

    // Merchant rule should win over keyword
    expect(result.categoryId).toBe('cat-supermarket');
    expect(result.source).toBe('rule_merchant');
  });
});

describe('suggestRuleFromCorrection', () => {
  it('should suggest merchant rule when merchant is available', () => {
    const tx: TransactionInput = {
      description: 'Some purchase',
      merchant: 'Test Store',
      amount: 100,
      direction: 'expense',
    };

    const suggestion = suggestRuleFromCorrection(tx, 'cat-shopping');

    expect(suggestion).not.toBeNull();
    expect(suggestion?.type).toBe('merchant');
    expect(suggestion?.pattern).toBe('Test Store');
    expect(suggestion?.categoryId).toBe('cat-shopping');
  });

  it('should suggest keyword rule when no merchant', () => {
    const tx: TransactionInput = {
      description: 'Insurance payment monthly',
      amount: 500,
      direction: 'expense',
    };

    const suggestion = suggestRuleFromCorrection(tx, 'cat-insurance');

    expect(suggestion).not.toBeNull();
    expect(suggestion?.type).toBe('keyword');
    expect(suggestion?.categoryId).toBe('cat-insurance');
    // Should pick the longest word
    expect(suggestion?.pattern).toBe('Insurance');
  });

  it('should return null for short description without merchant', () => {
    const tx: TransactionInput = {
      description: 'ABC',
      amount: 100,
      direction: 'expense',
    };

    const suggestion = suggestRuleFromCorrection(tx, 'cat-other');

    expect(suggestion).toBeNull();
  });
});
