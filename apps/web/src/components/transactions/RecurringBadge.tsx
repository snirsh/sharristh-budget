import { cn } from '@/lib/utils';
import { RefreshCcw } from 'lucide-react';

interface RecurringTemplate {
  id: string;
  name: string;
  frequency: string;
}

interface RecurringBadgeProps {
  recurringTemplate: RecurringTemplate | null;
  className?: string;
}

/**
 * Get human-readable frequency label
 */
const getFrequencyLabel = (frequency: string): string => {
  switch (frequency) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    default:
      return 'Recurring';
  }
};

/**
 * Visual indicator for recurring transactions
 * Shows when a transaction matches a recurring template
 */
export function RecurringBadge({ recurringTemplate, className }: RecurringBadgeProps) {
  if (!recurringTemplate) {
    return null;
  }

  const frequencyLabel = getFrequencyLabel(recurringTemplate.frequency);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
        'bg-teal-100 text-teal-800 border border-teal-200',
        'dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800',
        className
      )}
      title={`${frequencyLabel} expense: ${recurringTemplate.name}`}
    >
      <RefreshCcw className="h-3 w-3" />
      <span>{frequencyLabel}</span>
    </span>
  );
}

/**
 * Compact version for table cells (just the icon with tooltip)
 */
export function RecurringBadgeCompact({
  recurringTemplate,
}: Pick<RecurringBadgeProps, 'recurringTemplate'>) {
  if (!recurringTemplate) {
    return null;
  }

  const frequencyLabel = getFrequencyLabel(recurringTemplate.frequency);

  return (
    <span
      className="inline-flex items-center"
      title={`${frequencyLabel} expense: ${recurringTemplate.name}`}
    >
      <RefreshCcw className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
    </span>
  );
}
