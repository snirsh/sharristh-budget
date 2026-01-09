'use client';

import { cn } from '@/lib/utils';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface LargeTransaction {
  id: string;
  description: string;
  merchant: string | null;
  amount: number;
  date: Date;
  categoryName: string | null;
  categoryIcon: string | null;
  accountName: string | null;
  formattedAmount: string;
  formattedDate: string;
}

interface LargestTransactionsListProps {
  transactions: LargeTransaction[];
  title?: string;
  className?: string;
}

export function LargestTransactionsList({
  transactions,
  title = 'Largest Expenses',
  className,
}: LargestTransactionsListProps) {
  if (transactions.length === 0) {
    return (
      <div className={cn('card', className)}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-gray-400" />
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No expenses this month
        </p>
      </div>
    );
  }

  return (
    <div className={cn('card', className)}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <ArrowUpRight className="h-4 w-4 text-gray-400" />
        {title}
      </h3>
      <div className="space-y-2">
        {transactions.map((tx, index) => (
          <Link
            key={tx.id}
            href={`/transactions?search=${encodeURIComponent(tx.description)}`}
            className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
              {index + 1}
            </div>
            <span className="text-lg flex-shrink-0">{tx.categoryIcon || '💸'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
                {tx.merchant || tx.description}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {tx.formattedDate}
                {tx.categoryName && <> · {tx.categoryName}</>}
              </p>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white flex-shrink-0">
              {tx.formattedAmount}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
