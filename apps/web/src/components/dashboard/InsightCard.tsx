'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface InsightCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  /** Whether higher values are good (e.g., for savings) or bad (e.g., for expenses) */
  trendPositive?: 'up' | 'down';
  className?: string;
}

export function InsightCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  trendPositive = 'down', // For expenses, down is usually good
  className,
}: InsightCardProps) {
  // Determine trend color based on whether higher is good or bad
  const getTrendColor = () => {
    if (!trend || trend === 'flat') return 'text-gray-500 dark:text-gray-400';
    
    const isPositiveTrend = 
      (trend === 'up' && trendPositive === 'up') || 
      (trend === 'down' && trendPositive === 'down');
    
    return isPositiveTrend 
      ? 'text-success-600 dark:text-success-400' 
      : 'text-danger-600 dark:text-danger-400';
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className={cn('card p-4', className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        {Icon && (
          <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        )}
      </div>
      
      <p className="text-xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      
      {(subtitle || trend) && (
        <div className="flex items-center gap-1.5 mt-1">
          {trend && (
            <div className={cn('flex items-center gap-0.5', getTrendColor())}>
              <TrendIcon className="h-3.5 w-3.5" />
              {trendValue && (
                <span className="text-xs font-medium">{trendValue}</span>
              )}
            </div>
          )}
          {subtitle && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface CompactInsightCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function CompactInsightCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-gray-400',
  className,
}: CompactInsightCardProps) {
  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50', className)}>
      {Icon && (
        <div className={cn('p-2 rounded-lg bg-white dark:bg-gray-600', iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}
