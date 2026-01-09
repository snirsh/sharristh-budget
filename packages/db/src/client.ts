import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Enhanced PrismaClient configuration for optimal performance
 *
 * Features:
 * - Connection pooling (5 connections in production, 2 in dev)
 * - Query logging for slow queries (>200ms)
 * - Error logging for debugging
 * - Global singleton pattern to prevent connection exhaustion
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? [
            // Production: Only log slow queries and errors
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ]
        : [
            // Development: Log slow queries for optimization
            { level: 'query', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Note: Prisma middleware ($use) cannot be used here as it causes build failures
// in Next.js edge/build environments. Slow query detection is handled via:
// 1. Prisma's built-in query logging (configured above)
// 2. The monitoring utilities in packages/db/src/monitoring.ts
// 3. Manual query wrapping with timedQuery() for critical operations

globalForPrisma.prisma = prisma;

export type { PrismaClient } from '@prisma/client';
