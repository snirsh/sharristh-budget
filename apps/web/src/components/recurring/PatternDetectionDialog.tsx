'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { formatCurrency, cn } from '@/lib/utils';
import { X, TrendingUp, Calendar, DollarSign, Sparkles, Loader2 } from 'lucide-react';

interface PatternDetectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PatternDetectionDialog({ isOpen, onClose }: PatternDetectionDialogProps) {
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: patterns = [], isLoading } = trpc.recurring.detectPatterns.useQuery(
    undefined,
    { enabled: isOpen } // Only fetch when dialog is open
  );

  const { data: categories = [] } = trpc.categories.list.useQuery();

  const createMutation = trpc.recurring.createFromPattern.useMutation({
    onSuccess: () => {
      utils.recurring.list.invalidate();
      alert('Recurring template created successfully!');
      onClose();
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleCreateTemplate = (pattern: typeof patterns[0]) => {
    if (!pattern) return;

    // Use the most recent transaction's date as the start date
    const mostRecentTx = pattern.transactions[pattern.transactions.length - 1];
    if (!mostRecentTx) return;

    // Find a category that matches the merchant name
    const matchedCategory = categories.find((cat) =>
      cat.name.toLowerCase().includes(pattern.normalizedMerchant.toLowerCase())
    );

    createMutation.mutate({
      merchant: pattern.merchant,
      amount: pattern.averageAmount,
      categoryId: matchedCategory?.id,
      frequency: pattern.estimatedFrequency,
      interval: pattern.estimatedInterval,
      byMonthDay: pattern.estimatedDayOfMonth,
      startDate: new Date(mostRecentTx.date),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Detected Recurring Patterns
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isLoading
                  ? 'Analyzing your transactions...'
                  : `Found ${patterns.length} potential recurring transaction${patterns.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
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
              <span className="ml-2 text-gray-500">Analyzing transactions...</span>
            </div>
          )}

          {!isLoading && patterns.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No recurring patterns detected</p>
              <p className="text-sm text-gray-400 mt-1">
                Try adding more transactions or adjusting the detection settings
              </p>
            </div>
          )}

          {!isLoading && patterns.length > 0 && (
            <div className="space-y-4">
              {patterns.map((pattern, idx) => (
                <PatternCard
                  key={idx}
                  pattern={pattern}
                  isExpanded={selectedPattern === `${idx}`}
                  onToggle={() =>
                    setSelectedPattern(selectedPattern === `${idx}` ? null : `${idx}`)
                  }
                  onCreateTemplate={() => handleCreateTemplate(pattern)}
                  isCreating={createMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn btn-outline">
              Close
            </button>
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
  };
  isExpanded: boolean;
  onToggle: () => void;
  onCreateTemplate: () => void;
  isCreating: boolean;
}

function PatternCard({
  pattern,
  isExpanded,
  onToggle,
  onCreateTemplate,
  isCreating,
}: PatternCardProps) {
  const confidencePercent = Math.round(pattern.confidence * 100);

  const confidenceColor =
    confidencePercent >= 80
      ? 'text-success-700 bg-success-100 border-success-200'
      : confidencePercent >= 60
      ? 'text-warning-700 bg-warning-100 border-warning-200'
      : 'text-gray-700 bg-gray-100 border-gray-200';

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
    <div className="card p-0 overflow-hidden border border-gray-200">
      {/* Header */}
      <div
        className="p-4 hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">{pattern.merchant}</h3>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                  confidenceColor
                )}
              >
                {confidencePercent}% confidence
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{pattern.reason}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900">
                {formatCurrency(pattern.averageAmount)}
              </div>
              <div className="text-xs text-gray-500">Average amount</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900 capitalize">
                {formatFrequency()}
              </div>
              <div className="text-xs text-gray-500">Frequency</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900">{pattern.occurrences}</div>
              <div className="text-xs text-gray-500">Occurrences</div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Recent Transactions ({pattern.transactions.length})
          </h4>
          <div className="space-y-2 mb-4">
            {pattern.transactions.slice(-5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between text-sm bg-white rounded px-3 py-2"
              >
                <div>
                  <span className="text-gray-600">
                    {new Date(tx.date).toLocaleDateString()}
                  </span>
                  <span className="text-gray-400 mx-2">•</span>
                  <span className="text-gray-900">{tx.description}</span>
                </div>
                <span className="font-medium text-gray-900">
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
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
          </div>
        </div>
      )}
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}
