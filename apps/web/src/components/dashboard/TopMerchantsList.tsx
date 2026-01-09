'use client';

import { cn } from '@/lib/utils';
import { Store } from 'lucide-react';

interface Merchant {
  merchant: string;
  total: number;
  count: number;
  formattedTotal: string;
}

interface TopMerchantsListProps {
  merchants: Merchant[];
  title?: string;
  className?: string;
}

export function TopMerchantsList({
  merchants,
  title = 'Top Merchants',
  className,
}: TopMerchantsListProps) {
  if (merchants.length === 0) {
    return (
      <div className={cn('card', className)}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Store className="h-4 w-4 text-gray-400" />
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No merchant data this month
        </p>
      </div>
    );
  }

  // Calculate the max total for progress bar scaling
  const maxTotal = Math.max(...merchants.map((m) => m.total));

  return (
    <div className={cn('card', className)}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <Store className="h-4 w-4 text-gray-400" />
        {title}
      </h3>
      <div className="space-y-3">
        {merchants.map((merchant, index) => {
          const percentage = (merchant.total / maxTotal) * 100;
          return (
            <div key={merchant.merchant} className="relative">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-4">
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white truncate">
                    {merchant.merchant}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {merchant.count} txn{merchant.count !== 1 ? 's' : ''}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {merchant.formattedTotal}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
