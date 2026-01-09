'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { useEffect } from 'react';

/**
 * Web Vitals Performance Monitoring
 *
 * Tracks Core Web Vitals and custom metrics:
 * - CLS (Cumulative Layout Shift): Visual stability
 * - FCP (First Contentful Paint): Initial render speed
 * - FID (First Input Delay): Interactivity
 * - LCP (Largest Contentful Paint): Loading performance
 * - TTFB (Time to First Byte): Server response time
 * - INP (Interaction to Next Paint): Responsiveness
 *
 * Metrics are logged to console in development and can be sent to
 * analytics services (Vercel Analytics, Google Analytics, etc.) in production.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    // Format metric value based on type
    const value = Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value);

    // Development: Log all metrics to console
    if (process.env.NODE_ENV === 'development') {
      const rating = getMetricRating(metric.name, metric.value);
      console.log(`[Web Vitals] ${metric.name}: ${value}${getMetricUnit(metric.name)} (${rating})`);
    }

    // Production: Send to analytics service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to your analytics endpoint
      sendToAnalytics(metric);
    }
  });

  // Track additional custom metrics in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Track initial hydration time
      const hydrationStart = performance.now();

      // Log when hydration completes
      requestIdleCallback(() => {
        const hydrationTime = Math.round(performance.now() - hydrationStart);
        console.log(`[Web Vitals] Hydration: ${hydrationTime}ms`);
      });
    }
  }, []);

  return null; // This component doesn't render anything
}

/**
 * Get performance rating for a metric
 */
function getMetricRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    FID: [100, 300],
    LCP: [2500, 4000],
    TTFB: [800, 1800],
    INP: [200, 500],
  };

  const [good, poor] = thresholds[name] || [0, 0];

  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Get appropriate unit for metric
 */
function getMetricUnit(name: string): string {
  return name === 'CLS' ? '' : 'ms';
}

/**
 * Send metrics to analytics service
 * Replace with your analytics provider (Vercel, Google Analytics, etc.)
 */
function sendToAnalytics(metric: {
  name: string;
  value: number;
  id: string;
  rating?: string;
}) {
  // Example: Send to custom analytics endpoint
  // fetch('/api/analytics', {
  //   method: 'POST',
  //   body: JSON.stringify(metric),
  // });

  // Example: Send to Vercel Analytics
  // import { sendAnalytics } from '@vercel/analytics';
  // sendAnalytics(metric);

  // Example: Send to Google Analytics
  // window.gtag?.('event', metric.name, {
  //   value: Math.round(metric.value),
  //   metric_id: metric.id,
  //   metric_rating: metric.rating,
  // });

  // For now, just log to console in production
  console.log('[Analytics]', metric);
}
