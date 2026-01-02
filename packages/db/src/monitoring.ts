/**
 * Database Query Performance Monitoring
 *
 * Provides utilities for tracking and logging database query performance.
 * Use these functions to wrap database operations and collect metrics.
 */

type QueryMetric = {
  operation: string;
  duration: number;
  timestamp: Date;
  model?: string;
  action?: string;
};

const queryMetrics: QueryMetric[] = [];
const MAX_METRICS = 1000; // Keep last 1000 queries

/**
 * Record a query metric
 */
export function recordQueryMetric(metric: QueryMetric): void {
  queryMetrics.push(metric);

  // Keep only the last MAX_METRICS
  if (queryMetrics.length > MAX_METRICS) {
    queryMetrics.shift();
  }

  // Log slow queries in development
  if (process.env.NODE_ENV === 'development' && metric.duration > 100) {
    console.warn(
      `[DB Slow Query] ${metric.operation} took ${metric.duration}ms`
    );
  }
}

/**
 * Get query statistics
 */
export function getQueryStats(): {
  total: number;
  slow: number;
  average: number;
  p95: number;
  p99: number;
} {
  if (queryMetrics.length === 0) {
    return { total: 0, slow: 0, average: 0, p95: 0, p99: 0 };
  }

  const sorted = [...queryMetrics]
    .map((m) => m.duration)
    .sort((a, b) => a - b);

  const total = queryMetrics.length;
  const slow = queryMetrics.filter((m) => m.duration > 200).length;
  const average =
    queryMetrics.reduce((sum, m) => sum + m.duration, 0) / total;
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    total,
    slow,
    average: Math.round(average),
    p95: sorted[p95Index] || 0,
    p99: sorted[p99Index] || 0,
  };
}

/**
 * Get slow queries (>200ms)
 */
export function getSlowQueries(limit = 10): QueryMetric[] {
  return queryMetrics
    .filter((m) => m.duration > 200)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit);
}

/**
 * Clear all metrics (useful for testing)
 */
export function clearQueryMetrics(): void {
  queryMetrics.length = 0;
}

/**
 * Wrapper for timed database operations
 */
export async function timedQuery<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - start;

    recordQueryMetric({
      operation,
      duration,
      timestamp: new Date(),
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    recordQueryMetric({
      operation: `${operation} (ERROR)`,
      duration,
      timestamp: new Date(),
    });

    throw error;
  }
}

/**
 * Log query statistics summary
 */
export function logQueryStatsSummary(): void {
  const stats = getQueryStats();

  console.log('\n📊 Database Query Performance Summary:');
  console.log(`Total Queries: ${stats.total}`);
  console.log(`Slow Queries (>200ms): ${stats.slow}`);
  console.log(`Average Duration: ${stats.average}ms`);
  console.log(`P95 Duration: ${stats.p95}ms`);
  console.log(`P99 Duration: ${stats.p99}ms`);

  const slowQueries = getSlowQueries(5);
  if (slowQueries.length > 0) {
    console.log('\n⚠️  Top 5 Slowest Queries:');
    slowQueries.forEach((q, i) => {
      console.log(`${i + 1}. ${q.operation}: ${q.duration}ms`);
    });
  }

  console.log('');
}
