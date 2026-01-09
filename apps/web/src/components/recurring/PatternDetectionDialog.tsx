'use client';

import { trpc } from '@/lib/trpc/client';
import { cn, formatCurrency } from '@/lib/utils';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Check,
  DollarSign,
  Loader2,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface PatternDetectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PatternDetectionDialog({
  isOpen,
  onClose,
  onSuccess,
}: PatternDetectionDialogProps) {
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [addedPatterns, setAddedPatterns] = useState<Set<string>>(new Set());
  const [creatingPattern, setCreatingPattern] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: patterns = [], isLoading } = trpc.recurring.detectPatterns.useQuery(
    undefined,
    { enabled: isOpen } // Only fetch when dialog is open
  );

  const { data: categories = [] } = trpc.categories.list.useQuery();

  const createMutation = trpc.recurring.createFromPattern.useMutation({
    onSuccess: (_data, variables) => {
      utils.recurring.list.invalidate();
      onSuccess?.();
      // Mark the pattern as added using the merchant name
      setAddedPatterns((prev) => new Set(prev).add(variables.merchant));
      setCreatingPattern(null);
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
      setCreatingPattern(null);
    },
  });

  // Reset state when dialog closes
  const handleClose = () => {
    setSelectedPattern(null);
    setAddedPatterns(new Set());
    setCreatingPattern(null);
    onClose();
  };

  const handleCreateTemplate = (pattern: (typeof patterns)[0]) => {
    if (!pattern) return;

    // Use the most recent transaction's date as the start date
    const mostRecentTx = pattern.transactions[pattern.transactions.length - 1];
    if (!mostRecentTx) return;

    // Find a category that matches the merchant name and direction
    const matchedCategory = categories.find(
      (cat) =>
        cat.name.toLowerCase().includes(pattern.normalizedMerchant.toLowerCase()) &&
        cat.type === pattern.direction
    );

    setCreatingPattern(pattern.merchant);

    createMutation.mutate({
      merchant: pattern.merchant,
      amount: pattern.averageAmount,
      categoryId: matchedCategory?.id,
      frequency: pattern.estimatedFrequency,
      interval: pattern.estimatedInterval,
      byMonthDay: pattern.estimatedDayOfMonth,
      startDate: new Date(mostRecentTx.date),
      direction: pattern.direction,
    });
  };

  // Filter out already-added patterns and sort them (added ones at the end)
  const remainingPatterns = patterns.filter((p) => !addedPatterns.has(p.merchant));
  const addedPatternsList = patterns.filter((p) => addedPatterns.has(p.merchant));
  const sortedPatterns = [...remainingPatterns, ...addedPatternsList];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Detected Recurring Patterns
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isLoading
                  ? 'Analyzing your transactions...'
                  : addedPatterns.size > 0
                    ? `Found ${patterns.length} patterns • ${addedPatterns.size} added`
                    : `Found ${patterns.length} potential recurring transaction${patterns.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                Analyzing transactions...
              </span>
            </div>
          )}

          {!isLoading && patterns.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                No recurring patterns detected
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Try adding more transactions or adjusting the detection settings
              </p>
            </div>
          )}

          {!isLoading && patterns.length > 0 && (
            <div className="space-y-4">
              {sortedPatterns.map((pattern) => {
                const isAdded = addedPatterns.has(pattern.merchant);
                const isCreatingThis = creatingPattern === pattern.merchant;
                return (
                  <PatternCard
                    key={pattern.merchant}
                    pattern={pattern}
                    isExpanded={selectedPattern === pattern.merchant}
                    onToggle={() =>
                      setSelectedPattern(
                        selectedPattern === pattern.merchant ? null : pattern.merchant
                      )
                    }
                    onCreateTemplate={() => handleCreateTemplate(pattern)}
                    isCreating={isCreatingThis}
                    isAdded={isAdded}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            {addedPatterns.size > 0 && (
              <p className="text-sm text-success-600 dark:text-success-400 flex items-center gap-1">
                <Check className="h-4 w-4" />
                {addedPatterns.size} template{addedPatterns.size !== 1 ? 's' : ''} added
              </p>
            )}
            <div className="flex justify-end gap-3 ml-auto">
              <button onClick={handleClose} className="btn btn-outline">
                {addedPatterns.size > 0 ? 'Done' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PatternCardProps {
  pattern: {
    merchant: string;
    normalizedMerchant: string;
    averageAmount: number;
    amountStdDev: number;
    occurrences: number;
    transactions: Array<{
      id: string;
      date: Date;
      description: string;
      merchant: string | null;
      amount: number;
    }>;
    estimatedFrequency: string;
    estimatedInterval: number;
    estimatedDayOfMonth?: number;
    confidence: number;
    reason: string;
    direction: 'income' | 'expense';
  };
  isExpanded: boolean;
  onToggle: () => void;
  onCreateTemplate: () => void;
  isCreating: boolean;
  isAdded: boolean;
}

function PatternCard({
  pattern,
  isExpanded,
  onToggle,
  onCreateTemplate,
  isCreating,
  isAdded,
}: PatternCardProps) {
  const confidencePercent = Math.round(pattern.confidence * 100);
  const isIncome = pattern.direction === 'income';

  const confidenceColor =
    confidencePercent >= 80
      ? 'text-success-700 dark:text-success-400 bg-success-100 dark:bg-success-900/30 border-success-200 dark:border-success-800'
      : confidencePercent >= 60
        ? 'text-warning-700 dark:text-warning-400 bg-warning-100 dark:bg-warning-900/30 border-warning-200 dark:border-warning-800'
        : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600';

  const directionBadgeColor = isIncome
    ? 'text-success-700 dark:text-success-400 bg-success-100 dark:bg-success-900/30 border-success-200 dark:border-success-800'
    : 'text-danger-700 dark:text-danger-400 bg-danger-100 dark:bg-danger-900/30 border-danger-200 dark:border-danger-800';

  const formatFrequency = () => {
    if (pattern.estimatedInterval === 1) {
      return pattern.estimatedFrequency;
    }
    switch (pattern.estimatedFrequency) {
      case 'weekly':
        return pattern.estimatedInterval === 2
          ? 'bi-weekly'
          : `every ${pattern.estimatedInterval} weeks`;
      case 'monthly':
        return pattern.estimatedInterval === 2
          ? 'bi-monthly'
          : `every ${pattern.estimatedInterval} months`;
      case 'yearly':
        return `every ${pattern.estimatedInterval} years`;
      default:
        return pattern.estimatedFrequency;
    }
  };

  return (
    <div
      className={cn(
        'card p-0 overflow-hidden border',
        isAdded
          ? 'border-success-300 dark:border-success-700 bg-success-50/50 dark:bg-success-900/20'
          : isIncome
            ? 'border-success-200 dark:border-success-800'
            : 'border-gray-200 dark:border-gray-700'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'p-4 cursor-pointer',
          isAdded
            ? 'hover:bg-success-50 dark:hover:bg-success-900/30'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
        )}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {/* Direction icon */}
              {isIncome ? (
                <ArrowUpCircle className="h-5 w-5 text-success-500 flex-shrink-0" />
              ) : (
                <ArrowDownCircle className="h-5 w-5 text-danger-500 flex-shrink-0" />
              )}
              <h3 className="font-semibold text-gray-900 dark:text-white">{pattern.merchant}</h3>
              {/* Direction badge */}
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                  directionBadgeColor
                )}
              >
                {isIncome ? 'Income' : 'Expense'}
              </span>
              {isAdded ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border text-success-700 dark:text-success-400 bg-success-100 dark:bg-success-900/30 border-success-200 dark:border-success-800">
                  <Check className="h-3 w-3" />
                  Added
                </span>
              ) : (
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                    confidenceColor
                  )}
                >
                  {confidencePercent}% confidence
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{pattern.reason}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign
              className={cn('h-4 w-4', isIncome ? 'text-success-500' : 'text-gray-400')}
            />
            <div>
              <div
                className={cn(
                  'font-medium',
                  isIncome
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-gray-900 dark:text-white'
                )}
              >
                {isIncome ? '+' : ''}
                {formatCurrency(pattern.averageAmount)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Average amount</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white capitalize">
                {formatFrequency()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Frequency</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{pattern.occurrences}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Occurrences</div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
            Recent Transactions ({pattern.transactions.length})
          </h4>
          <div className="space-y-2 mb-4">
            {pattern.transactions.slice(-5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded px-3 py-2"
              >
                <div>
                  <span className="text-gray-600 dark:text-gray-300">
                    {new Date(tx.date).toLocaleDateString()}
                  </span>
                  <span className="text-gray-400 mx-2">•</span>
                  <span className="text-gray-900 dark:text-white">{tx.description}</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            {isAdded ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-success-700 dark:text-success-400">
                <Check className="h-4 w-4" />
                Template Created
              </span>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateTemplate();
                }}
                disabled={isCreating}
                className="btn btn-primary"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Recurring Template
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
