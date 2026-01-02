import { router } from './trpc';
import {
  transactionsRouter,
  categoriesRouter,
  budgetsRouter,
  recurringRouter,
  rulesRouter,
  dashboardRouter,
  bankConnectionsRouter,
  accountsRouter,
  demoRouter,
  performanceRouter,
  invitesRouter,
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

