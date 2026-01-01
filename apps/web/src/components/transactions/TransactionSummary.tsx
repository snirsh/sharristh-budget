'use client';

import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

type Transaction = {
  amount: number;
  direction: string;
  isIgnored?: boolean;
};

type TransactionSummaryProps = {
  transactions: Transaction[];
};

export const TransactionSummary = ({ transactions }: TransactionSummaryProps) => {
  // Filter out ignored transactions from summary calculations
  const activeTransactions = transactions.filter((t) => !t.isIgnored);
  
  const totalIncome = activeTransactions
    .filter((t) => t.direction === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = activeTransactions
    .filter((t) => t.direction === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Income */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Income</p>
            <p className="text-2xl font-bold text-success-600 mt-1">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="p-3 bg-success-100 rounded-lg">
            <TrendingUp className="h-6 w-6 text-success-600" />
          </div>
        </div>
      </div>

      {/* Total Expenses */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Expenses</p>
            <p className="text-2xl font-bold text-danger-600 mt-1">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <div className="p-3 bg-danger-100 rounded-lg">
            <TrendingDown className="h-6 w-6 text-danger-600" />
          </div>
        </div>
      </div>

      {/* Net Balance */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Net Balance</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                netBalance >= 0 ? 'text-success-600' : 'text-danger-600'
              }`}
            >
              {netBalance >= 0 ? '+' : ''}
              {formatCurrency(Math.abs(netBalance))}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${
            netBalance >= 0 ? 'bg-success-100' : 'bg-danger-100'
          }`}>
            <DollarSign className={`h-6 w-6 ${
              netBalance >= 0 ? 'text-success-600' : 'text-danger-600'
            }`} />
          </div>
        </div>
      </div>
    </div>
  );
}
