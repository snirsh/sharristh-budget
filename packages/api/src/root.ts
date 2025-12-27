import { router } from './trpc';
import {
  transactionsRouter,
  categoriesRouter,
  budgetsRouter,
  recurringRouter,
  rulesRouter,
  dashboardRouter,
} from './routers';

/**
 * Main application router
 */
export const appRouter = router({
  transactions: transactionsRouter,
  categories: categoriesRouter,
  budgets: budgetsRouter,
  recurring: recurringRouter,
  rules: rulesRouter,
  dashboard: dashboardRouter,
});

/**
 * Type definition for the app router
 */
export type AppRouter = typeof appRouter;

