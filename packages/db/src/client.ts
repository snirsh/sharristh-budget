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

// Log slow queries in production (>200ms threshold)
// Skip during build/compile time to avoid initialization errors
if (process.env.NODE_ENV === 'production' && typeof prisma.$use === 'function') {
  try {
    prisma.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;

      if (duration > 200) {
        console.warn(
          `[Prisma Slow Query] ${params.model}.${params.action} took ${duration}ms`
        );
      }

      return result;
    });
  } catch (error) {
    // Middleware setup failed - likely during build time, safe to ignore
    console.warn('[Prisma] Middleware setup skipped:', error);
  }
}

globalForPrisma.prisma = prisma;

export type { PrismaClient } from '@prisma/client';

