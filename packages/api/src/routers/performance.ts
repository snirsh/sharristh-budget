import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { getQueryStats, getSlowQueries } from '@sfam/db';

/**
 * Performance Monitoring Router
 *
 * Provides endpoints for tracking and analyzing application performance.
 * Includes database query metrics and slow query analysis.
 *
 * Note: In production, you may want to restrict these endpoints to admin users only.
 */
export const performanceRouter = createTRPCRouter({
  /**
   * Get database query statistics
   */
  getQueryStats: publicProcedure.query(() => {
    const stats = getQueryStats();

    return {
      total: stats.total,
      slow: stats.slow,
      slowPercentage:
        stats.total > 0
          ? Math.round((stats.slow / stats.total) * 100)
          : 0,
      average: stats.average,
      p95: stats.p95,
      p99: stats.p99,
    };
  }),

  /**
   * Get slowest queries
   */
  getSlowQueries: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(10),
        })
        .optional()
    )
    .query(({ input }) => {
      const limit = input?.limit ?? 10;
      const slowQueries = getSlowQueries(limit);

      return slowQueries.map((q) => ({
        operation: q.operation,
        duration: q.duration,
        timestamp: q.timestamp.toISOString(),
      }));
    }),

  /**
   * Get performance summary (combines multiple metrics)
   */
  getSummary: publicProcedure.query(() => {
    const queryStats = getQueryStats();
    const slowQueries = getSlowQueries(5);

    return {
      database: {
        totalQueries: queryStats.total,
        slowQueries: queryStats.slow,
        averageDuration: queryStats.average,
        p95Duration: queryStats.p95,
        p99Duration: queryStats.p99,
        topSlowQueries: slowQueries.map((q) => ({
          operation: q.operation,
          duration: q.duration,
        })),
      },
      recommendations: generateRecommendations(queryStats, slowQueries),
    };
  }),
});

/**
 * Generate performance recommendations based on metrics
 */
function generateRecommendations(
  stats: ReturnType<typeof getQueryStats>,
  slowQueries: ReturnType<typeof getSlowQueries>
): string[] {
  const recommendations: string[] = [];

  // Check slow query percentage
  const slowPercentage = stats.total > 0 ? (stats.slow / stats.total) * 100 : 0;
  if (slowPercentage > 10) {
    recommendations.push(
      `${slowPercentage.toFixed(1)}% of queries are slow (>200ms). Consider adding indexes or optimizing queries.`
    );
  }

  // Check P95 duration
  if (stats.p95 > 500) {
    recommendations.push(
      `P95 query duration is ${stats.p95}ms. Consider implementing query result caching.`
    );
  }

  // Check P99 duration
  if (stats.p99 > 1000) {
    recommendations.push(
      `P99 query duration is ${stats.p99}ms. Some queries are extremely slow - investigate immediately.`
    );
  }

  // Check average duration
  if (stats.average > 200) {
    recommendations.push(
      `Average query duration is ${stats.average}ms. Consider optimizing common queries.`
    );
  }

  // Check for specific slow operations
  const slowOperations = slowQueries.map((q) => q.operation);
  const uniqueSlowOps = [...new Set(slowOperations)];
  if (uniqueSlowOps.length > 0 && uniqueSlowOps.length < 5) {
    recommendations.push(
      `Slow queries detected in: ${uniqueSlowOps.join(', ')}. Focus optimization efforts here.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Database performance looks good!');
  }

  return recommendations;
}
