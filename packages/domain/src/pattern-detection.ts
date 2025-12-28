/**
 * Pattern detection for recurring transactions
 * Analyzes transaction history to identify subscription-like patterns
 */

import type { RecurringFrequency } from './types';

export interface Transaction {
  id: string;
  date: Date;
  description: string;
  merchant: string | null;
  amount: number;
  direction: 'income' | 'expense' | 'transfer';
}

export interface TransactionPattern {
  merchant: string;
  normalizedMerchant: string;
  averageAmount: number;
  amountStdDev: number;
  occurrences: number;
  transactions: Transaction[];
  estimatedFrequency: RecurringFrequency;
  estimatedInterval: number;
  estimatedDayOfMonth?: number;
  confidence: number; // 0-1
  reason: string;
}

export interface PatternDetectionConfig {
  lookbackMonths?: number; // Default: 6
  minOccurrences?: number; // Default: 2
  amountConsistencyThreshold?: number; // Default: 0.85 (85%)
  dateVarianceDays?: number; // Default: 3
}

interface DatePattern {
  frequency: RecurringFrequency;
  interval: number;
  dayOfMonth?: number;
  intervalConsistency: number; // 0-1
}

const DEFAULT_CONFIG: Required<PatternDetectionConfig> = {
  lookbackMonths: 6,
  minOccurrences: 2,
  amountConsistencyThreshold: 0.85,
  dateVarianceDays: 3,
};

/**
 * Detect recurring transaction patterns from transaction history
 */
export function detectRecurringPatterns(
  transactions: Transaction[],
  config?: PatternDetectionConfig
): TransactionPattern[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 1. Filter to lookback period
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - cfg.lookbackMonths);

  const recentTransactions = transactions.filter(
    (tx) => tx.date >= cutoffDate && tx.direction === 'expense' // Only expenses for now
  );

  // 2. Group by normalized merchant
  const merchantGroups = groupByMerchant(recentTransactions);

  // 3. Analyze each group for patterns
  const patterns: TransactionPattern[] = [];

  for (const [normalizedMerchant, txs] of Object.entries(merchantGroups)) {
    // Skip if not enough occurrences
    if (txs.length < cfg.minOccurrences) {
      continue;
    }

    // Sort by date
    const sortedTxs = [...txs].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Check that transactions span multiple months (not just multiple in same month)
    const uniqueMonths = new Set(
      sortedTxs.map((tx) => `${tx.date.getFullYear()}-${tx.date.getMonth()}`)
    );

    if (uniqueMonths.size < cfg.minOccurrences) {
      continue; // All transactions in same month or not enough different months
    }

    // Calculate amount consistency
    const amounts = sortedTxs.map((tx) => tx.amount);
    const amountConsistency = calculateConsistency(amounts);

    if (amountConsistency < cfg.amountConsistencyThreshold) {
      continue; // Too much variance in amounts
    }

    // Detect date pattern
    const datePattern = detectDatePattern(sortedTxs, cfg.dateVarianceDays);

    if (!datePattern) {
      continue; // No clear date pattern
    }

    // Calculate confidence score
    const confidence = calculatePatternConfidence(
      txs.length,
      amountConsistency,
      datePattern.intervalConsistency
    );

    // Build pattern
    const averageAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const amountStdDev = calculateStdDev(amounts);

    patterns.push({
      merchant: txs[0]!.merchant || normalizedMerchant,
      normalizedMerchant,
      averageAmount,
      amountStdDev,
      occurrences: txs.length,
      transactions: sortedTxs,
      estimatedFrequency: datePattern.frequency,
      estimatedInterval: datePattern.interval,
      estimatedDayOfMonth: datePattern.dayOfMonth,
      confidence,
      reason: buildReasonString(txs.length, amountConsistency, datePattern),
    });
  }

  // Sort by confidence (highest first)
  return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Group transactions by normalized merchant name
 */
function groupByMerchant(transactions: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};

  for (const tx of transactions) {
    const normalized = normalizeMerchantName(tx.merchant || tx.description);

    if (!groups[normalized]) {
      groups[normalized] = [];
    }
    groups[normalized]!.push(tx);
  }

  return groups;
}

/**
 * Normalize merchant name for grouping
 * - Lowercase
 * - Trim whitespace
 * - Remove common suffixes (Ltd, Inc, LLC, etc.)
 * - Remove extra spaces
 */
function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(ltd|inc|llc|corp|limited|co|company)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate consistency of values (inverse of coefficient of variation)
 * Returns 1.0 for perfectly consistent values, lower for higher variance
 */
function calculateConsistency(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return 1;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = calculateStdDev(values);

  if (mean === 0) return 0;

  // Coefficient of variation
  const cv = stdDev / mean;

  // Convert to consistency score (1 = perfect, 0 = very inconsistent)
  return Math.max(0, 1 - cv);
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Detect date pattern from sorted transactions
 */
function detectDatePattern(
  sortedTxs: Transaction[],
  maxVarianceDays: number
): DatePattern | null {
  if (sortedTxs.length < 2) return null;

  // Calculate intervals between consecutive transactions (in days)
  const intervals: number[] = [];
  for (let i = 1; i < sortedTxs.length; i++) {
    const daysDiff = Math.round(
      (sortedTxs[i]!.date.getTime() - sortedTxs[i - 1]!.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    intervals.push(daysDiff);
  }

  // Calculate average interval
  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const intervalStdDev = calculateStdDev(intervals);

  // Check if intervals are consistent
  const intervalConsistency = calculateConsistency(intervals);

  // If too much variance, no clear pattern
  if (intervalStdDev > maxVarianceDays * 2) {
    return null;
  }

  // Determine frequency based on average interval
  const { frequency, interval } = classifyFrequency(avgInterval);

  // For monthly patterns, extract day of month
  let dayOfMonth: number | undefined;
  if (frequency === 'monthly') {
    const daysOfMonth = sortedTxs.map((tx) => tx.date.getDate());
    const avgDayOfMonth = Math.round(
      daysOfMonth.reduce((sum, day) => sum + day, 0) / daysOfMonth.length
    );
    dayOfMonth = avgDayOfMonth;
  }

  return {
    frequency,
    interval,
    dayOfMonth,
    intervalConsistency,
  };
}

/**
 * Classify average interval into frequency category
 */
function classifyFrequency(avgDays: number): { frequency: RecurringFrequency; interval: number } {
  // Weekly: 6-8 days
  if (avgDays >= 6 && avgDays <= 8) {
    return { frequency: 'weekly', interval: 1 };
  }

  // Bi-weekly: 12-16 days
  if (avgDays >= 12 && avgDays <= 16) {
    return { frequency: 'weekly', interval: 2 };
  }

  // Monthly: 25-35 days
  if (avgDays >= 25 && avgDays <= 35) {
    return { frequency: 'monthly', interval: 1 };
  }

  // Bi-monthly: 55-70 days
  if (avgDays >= 55 && avgDays <= 70) {
    return { frequency: 'monthly', interval: 2 };
  }

  // Quarterly: 85-95 days
  if (avgDays >= 85 && avgDays <= 95) {
    return { frequency: 'monthly', interval: 3 };
  }

  // Yearly: 345-380 days
  if (avgDays >= 345 && avgDays <= 380) {
    return { frequency: 'yearly', interval: 1 };
  }

  // Default to monthly with calculated interval
  const monthsInterval = Math.round(avgDays / 30);
  return { frequency: 'monthly', interval: Math.max(1, monthsInterval) };
}

/**
 * Calculate pattern confidence score
 * Weighted combination of occurrences, amount consistency, and interval consistency
 */
function calculatePatternConfidence(
  occurrences: number,
  amountConsistency: number,
  intervalConsistency: number
): number {
  // Weights
  const occurrenceWeight = 0.3;
  const amountWeight = 0.4;
  const intervalWeight = 0.3;

  // Normalize occurrences (2 = 0.5, 3 = 0.7, 4 = 0.8, 5+ = 0.9)
  const occurrenceScore = Math.min(0.9, 0.3 + occurrences * 0.15);

  // Weighted average
  const confidence =
    occurrenceScore * occurrenceWeight +
    amountConsistency * amountWeight +
    intervalConsistency * intervalWeight;

  // Cap at 0.95 (never 100% certain)
  return Math.min(0.95, confidence);
}

/**
 * Build human-readable reason string
 */
function buildReasonString(
  occurrences: number,
  amountConsistency: number,
  datePattern: DatePattern
): string {
  const frequencyStr = formatFrequency(datePattern.frequency, datePattern.interval);
  const consistencyPercent = Math.round(amountConsistency * 100);

  let reason = `Found ${occurrences} ${frequencyStr} transactions with ${consistencyPercent}% amount consistency`;

  if (datePattern.dayOfMonth) {
    reason += ` on day ${datePattern.dayOfMonth} of month`;
  }

  return reason;
}

/**
 * Format frequency as human-readable string
 */
function formatFrequency(frequency: RecurringFrequency, interval: number): string {
  if (interval === 1) {
    return frequency;
  }

  switch (frequency) {
    case 'weekly':
      return interval === 2 ? 'bi-weekly' : `every ${interval} weeks`;
    case 'monthly':
      return interval === 2 ? 'bi-monthly' : `every ${interval} months`;
    case 'yearly':
      return `every ${interval} years`;
    default:
      return frequency;
  }
}
