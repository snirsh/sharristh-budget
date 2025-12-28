import crypto from 'crypto';
import type { MappedTransaction } from '../types';

/**
 * Generate a deduplication hash for a transaction
 * This creates a consistent hash that can be used to identify duplicate transactions
 */
export function generateTransactionHash(txn: MappedTransaction): string {
  const data = [
    txn.externalAccountId,
    txn.date.toISOString().split('T')[0], // Date only, no time
    txn.amount.toFixed(2),
    txn.description.toLowerCase().trim(),
    txn.direction,
  ].join('|');

  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Filter out transactions that already exist in the database
 * @param newTransactions - Transactions from the scraper
 * @param existingExternalIds - Set of external IDs already in the database
 * @returns Transactions that don't exist yet
 */
export function filterNewTransactions(
  newTransactions: MappedTransaction[],
  existingExternalIds: Set<string>
): MappedTransaction[] {
  return newTransactions.filter((txn) => !existingExternalIds.has(txn.externalId));
}

/**
 * Group transactions by external account ID
 */
export function groupByAccount(
  transactions: MappedTransaction[]
): Map<string, MappedTransaction[]> {
  const grouped = new Map<string, MappedTransaction[]>();

  for (const txn of transactions) {
    const existing = grouped.get(txn.externalAccountId) || [];
    existing.push(txn);
    grouped.set(txn.externalAccountId, existing);
  }

  return grouped;
}

