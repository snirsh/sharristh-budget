import type { ScrapedTransaction, ScrapedAccount, MappedTransaction } from '../types';

/**
 * Map a single scraped transaction to our app's transaction format
 */
export function mapTransaction(
  txn: ScrapedTransaction,
  externalAccountId: string
): MappedTransaction {
  // Determine direction based on amount sign
  const amount = Math.abs(txn.chargedAmount);
  const direction: 'income' | 'expense' = txn.chargedAmount >= 0 ? 'income' : 'expense';

  // Build notes from installment info and memo
  const notesParts: string[] = [];
  if (txn.type === 'installments' && txn.installments) {
    notesParts.push(`תשלום ${txn.installments.number}/${txn.installments.total}`);
  }
  if (txn.memo) {
    notesParts.push(txn.memo);
  }
  if (txn.originalCurrency && txn.originalCurrency !== 'ILS') {
    notesParts.push(`${txn.originalAmount} ${txn.originalCurrency}`);
  }

  // Generate external ID for deduplication
  const externalId = generateExternalId(txn, externalAccountId);

  return {
    externalId,
    date: new Date(txn.date),
    description: txn.description,
    merchant: extractMerchant(txn.description),
    amount,
    direction,
    notes: notesParts.length > 0 ? notesParts.join(' | ') : null,
    externalAccountId,
    externalCategory: txn.category, // Pass through category/sector from bank (e.g., Isracard)
  };
}

/**
 * Map all transactions from scraped accounts
 */
export function mapAccountTransactions(accounts: ScrapedAccount[]): MappedTransaction[] {
  const transactions: MappedTransaction[] = [];

  for (const account of accounts) {
    for (const txn of account.txns) {
      // Skip pending transactions
      if (txn.status === 'pending') {
        continue;
      }
      transactions.push(mapTransaction(txn, account.accountNumber));
    }
  }

  return transactions;
}

/**
 * Generate a unique external ID for a transaction
 * Used for deduplication
 */
function generateExternalId(
  txn: ScrapedTransaction,
  accountNumber: string
): string {
  // If the scraper provides an identifier, use it
  if (txn.identifier) {
    return `${accountNumber}_${txn.identifier}`;
  }

  // Otherwise, create a hash from transaction details
  const data = [
    accountNumber,
    txn.date,
    txn.chargedAmount.toFixed(2),
    txn.description,
    txn.installments ? `${txn.installments.number}/${txn.installments.total}` : '',
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${accountNumber}_${Math.abs(hash).toString(16)}`;
}

/**
 * Extract merchant name from description
 * Common patterns in Israeli bank descriptions
 */
function extractMerchant(description: string): string | null {
  // Remove common prefixes
  let cleaned = description
    .replace(/^(חיוב|תשלום|העברה|הוראת קבע|משיכה)\s*/i, '')
    .trim();

  // If description is very short, it's likely not a useful merchant
  if (cleaned.length < 3) {
    return null;
  }

  // Try to extract business name from common patterns
  // Pattern: "BUSINESS NAME - CITY" or "BUSINESS NAME"
  const dashIndex = cleaned.indexOf(' - ');
  if (dashIndex > 0) {
    cleaned = cleaned.substring(0, dashIndex);
  }

  // Limit length and return
  return cleaned.length > 100 ? cleaned.substring(0, 100) : cleaned;
}


