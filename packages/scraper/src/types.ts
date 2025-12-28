import { z } from 'zod';

// ============================================
// Provider Types
// ============================================

export type BankProvider = 'onezero' | 'isracard';

export const bankProviderSchema = z.enum(['onezero', 'isracard']);

// ============================================
// Credential Schemas
// ============================================

export const oneZeroCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  phoneNumber: z.string().min(1),
});

export const israCardCredentialsSchema = z.object({
  id: z.string().min(1),
  card6Digits: z.string().length(6),
  password: z.string().min(1),
});

export type OneZeroCredentials = z.infer<typeof oneZeroCredentialsSchema>;
export type IsraCardCredentials = z.infer<typeof israCardCredentialsSchema>;

export type ProviderCredentials = OneZeroCredentials | IsraCardCredentials;

// ============================================
// Scraper Transaction (from israeli-bank-scrapers)
// ============================================

export interface ScrapedTransaction {
  type: 'normal' | 'installments';
  identifier?: string | number;
  date: string;
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency?: string;
  description: string;
  memo?: string;
  category?: string; // Sector/category from Isracard
  installments?: {
    number: number;
    total: number;
  };
  status: 'completed' | 'pending';
}

export interface ScrapedAccount {
  accountNumber: string;
  txns: ScrapedTransaction[];
  balance?: number;
}

export interface ScrapeResult {
  success: boolean;
  accounts?: ScrapedAccount[];
  errorType?: string;
  errorMessage?: string;
}

// ============================================
// Mapped Transaction (for our app)
// ============================================

export interface MappedTransaction {
  externalId: string;
  date: Date;
  description: string;
  merchant: string | null;
  amount: number;
  direction: 'income' | 'expense';
  notes: string | null;
  externalAccountId: string;
  externalCategory?: string; // Sector/category from bank (e.g., Isracard)
}

// ============================================
// Sync Types
// ============================================

export type SyncStatus = 'pending' | 'running' | 'success' | 'error';

export interface SyncResult {
  success: boolean;
  transactionsFound: number;
  transactionsNew: number;
  errorMessage?: string;
}

// ============================================
// 2FA Types
// ============================================

export interface TwoFactorInitResult {
  success: boolean;
  sessionId?: string; // Session ID to pass to completeTwoFactor for stateful 2FA
  errorMessage?: string;
}

export interface TwoFactorCompleteResult {
  success: boolean;
  longTermToken?: string;
  errorMessage?: string;
}

