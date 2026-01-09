import {
  accountsRouter,
  bankConnectionsRouter,
  budgetsRouter,
  categoriesRouter,
  dashboardRouter,
  demoRouter,
  invitesRouter,
  performanceRouter,
  recurringRouter,
  rulesRouter,
  transactionsRouter,
} from './routers';
import { router } from './trpc';

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
  bankConnections: bankConnectionsRouter,
  accounts: accountsRouter,
  demo: demoRouter,
  performance: performanceRouter,
  invites: invitesRouter,
});

/**
 * Type definition for the app router
 */
export type AppRouter = typeof appRouter;
