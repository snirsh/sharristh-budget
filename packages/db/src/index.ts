export { prisma } from './client';

// Re-export all Prisma types and PrismaClient class
export * from '@prisma/client';

// Database performance monitoring utilities
export {
  recordQueryMetric,
  getQueryStats,
  getSlowQueries,
  clearQueryMetrics,
  timedQuery,
  logQueryStatsSummary,
} from './monitoring';

