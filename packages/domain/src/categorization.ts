import type {
  TransactionInput,
  CategoryRule,
  CategorizationResult,
  CategorizationSource,
} from './types';

/**
 * Default category IDs for fallback categorization
 */
const DEFAULT_CATEGORIES = {
  VARYING_EXPENSES: 'cat-varying',
  OTHER_INCOME: 'cat-other-income',
} as const;

/**
 * Categorizes a transaction based on rules and history
 *
 * Priority order:
 * 1. Manual category (already set) → source=manual, confidence=1.0
 * 2. Merchant rule match → confidence=0.95
 * 3. Keyword rule match → confidence=0.80
 * 4. Regex rule match → confidence=0.75
 * 5. Fallback (varying/other income) → confidence=0.50
 */
export function categorizeTransaction(
  tx: TransactionInput,
  rules: CategoryRule[],
  _history?: TransactionInput[]
): CategorizationResult {
  // 1. If category is already set, return as manual
  if (tx.categoryId) {
    return {
      categoryId: tx.categoryId,
      confidence: 1.0,
      source: 'manual',
      reason: 'Category was manually assigned',
      matchedRule: null,
    };
  }

  // Filter to active rules only and sort by priority (higher first)
  const activeRules = rules
    .filter((r) => r.isActive)
    .sort((a, b) => b.priority - a.priority);

  // 2. Try merchant rules first (highest confidence)
  const merchantRules = activeRules.filter((r) => r.type === 'merchant');
  const merchantMatch = matchMerchantRule(tx, merchantRules);
  if (merchantMatch) {
    return merchantMatch;
  }

  // 3. Try keyword rules
  const keywordRules = activeRules.filter((r) => r.type === 'keyword');
  const keywordMatch = matchKeywordRule(tx, keywordRules);
  if (keywordMatch) {
    return keywordMatch;
  }

  // 4. Try regex rules
  const regexRules = activeRules.filter((r) => r.type === 'regex');
  const regexMatch = matchRegexRule(tx, regexRules);
  if (regexMatch) {
    return regexMatch;
  }

  // 5. Fallback based on direction
  return getFallbackCategory(tx.direction);
}

/**
 * Match against merchant rules (case-insensitive contains)
 */
function matchMerchantRule(
  tx: TransactionInput,
  rules: CategoryRule[]
): CategorizationResult | null {
  if (!tx.merchant) return null;

  const merchantLower = tx.merchant.toLowerCase();

  for (const rule of rules) {
    const patternLower = rule.pattern.toLowerCase();
    if (merchantLower.includes(patternLower)) {
      return {
        categoryId: rule.categoryId,
        confidence: 0.95,
        source: 'rule_merchant',
        reason: `Merchant "${tx.merchant}" matches rule pattern "${rule.pattern}"`,
        matchedRule: rule,
      };
    }
  }

  return null;
}

/**
 * Match against keyword rules (case-insensitive, checks description and merchant)
 */
function matchKeywordRule(
  tx: TransactionInput,
  rules: CategoryRule[]
): CategorizationResult | null {
  const searchText = [tx.description, tx.merchant].filter(Boolean).join(' ').toLowerCase();

  for (const rule of rules) {
    const patternLower = rule.pattern.toLowerCase();
    if (searchText.includes(patternLower)) {
      return {
        categoryId: rule.categoryId,
        confidence: 0.8,
        source: 'rule_keyword',
        reason: `Text contains keyword "${rule.pattern}"`,
        matchedRule: rule,
      };
    }
  }

  return null;
}

/**
 * Match against regex rules
 */
function matchRegexRule(
  tx: TransactionInput,
  rules: CategoryRule[]
): CategorizationResult | null {
  const searchText = [tx.description, tx.merchant].filter(Boolean).join(' ');

  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(searchText)) {
        return {
          categoryId: rule.categoryId,
          confidence: 0.75,
          source: 'rule_regex',
          reason: `Text matches regex pattern "${rule.pattern}"`,
          matchedRule: rule,
        };
      }
    } catch {
      // Invalid regex, skip this rule
      continue;
    }
  }

  return null;
}

/**
 * Get fallback category based on transaction direction
 */
function getFallbackCategory(direction: string): CategorizationResult {
  if (direction === 'income') {
    return {
      categoryId: DEFAULT_CATEGORIES.OTHER_INCOME,
      confidence: 0.5,
      source: 'fallback',
      reason: 'No matching rules found, using default income category',
      matchedRule: null,
    };
  }

  return {
    categoryId: DEFAULT_CATEGORIES.VARYING_EXPENSES,
    confidence: 0.5,
    source: 'fallback',
    reason: 'No matching rules found, using varying expenses category',
    matchedRule: null,
  };
}

/**
 * Suggests a rule based on a user correction
 */
export function suggestRuleFromCorrection(
  tx: TransactionInput,
  categoryId: string
): { type: 'merchant' | 'keyword'; pattern: string; categoryId: string } | null {
  // Prefer merchant rule if merchant is available
  if (tx.merchant && tx.merchant.length >= 3) {
    return {
      type: 'merchant',
      pattern: tx.merchant,
      categoryId,
    };
  }

  // Otherwise, try to extract a meaningful keyword from description
  const words = tx.description.split(/\s+/).filter((w) => w.length >= 4);
  if (words.length > 0) {
    // Use the longest word as a potential keyword
    const keyword = words.sort((a, b) => b.length - a.length)[0];
    return {
      type: 'keyword',
      pattern: keyword ?? '',
      categoryId,
    };
  }

  return null;
}

/**
 * Batch categorize multiple transactions
 */
export function categorizeTransactions(
  transactions: TransactionInput[],
  rules: CategoryRule[]
): Map<TransactionInput, CategorizationResult> {
  const results = new Map<TransactionInput, CategorizationResult>();

  for (const tx of transactions) {
    results.set(tx, categorizeTransaction(tx, rules));
  }

  return results;
}

export type { CategorizationSource };

