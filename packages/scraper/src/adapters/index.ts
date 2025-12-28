// Export base adapter utilities
export { 
  type ScraperAdapter, 
  scraperAdapters, 
  registerAdapter, 
  getAdapter 
} from './base';

// Import adapters to register them
import './onezero';
import './isracard';

// Export adapter classes for direct use if needed
export { OneZeroAdapter } from './onezero';
export { IsracardAdapter } from './isracard';

