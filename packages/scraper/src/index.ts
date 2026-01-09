// Main service
export { ScraperService, scraperService } from './service';
export type { BankConnectionData, ScraperServiceConfig } from './service';

// Types
export type {
  BankProvider,
  OneZeroCredentials,
  IsraCardCredentials,
  ProviderCredentials,
  ScrapedTransaction,
  ScrapedAccount,
  ScrapeResult,
  MappedTransaction,
  SyncStatus,
  SyncResult,
  TwoFactorInitResult,
  TwoFactorCompleteResult,
} from './types';

export {
  bankProviderSchema,
  oneZeroCredentialsSchema,
  israCardCredentialsSchema,
} from './types';

// Encryption utilities
export {
  encryptCredentials,
  decryptCredentials,
  encryptToken,
  decryptToken,
} from './encryption';

// Adapters (registers them on import)
export { getAdapter, scraperAdapters } from './adapters';
export type { ScraperAdapter } from './adapters';

// Utilities
export {
  mapTransaction,
  mapAccountTransactions,
  generateTransactionHash,
  filterNewTransactions,
  groupByAccount,
} from './utils';
