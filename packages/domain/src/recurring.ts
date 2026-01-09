import type { RecurringOccurrence, RecurringOverride, RecurringTransactionTemplate } from './types';

/**
 * Generates all occurrences for a recurring template within a date range
 * This is deterministic and idempotent - same inputs always produce same outputs
 */
export function expandRecurringToRange(
  template: RecurringTransactionTemplate,
  startDate: Date,
  endDate: Date,
  overrides: RecurringOverride[] = []
): RecurringOccurrence[] {
  if (!template.isActive) return [];
  if (endDate < template.startDate) return [];
  if (template.endDate && startDate > template.endDate) return [];

  const occurrences: RecurringOccurrence[] = [];
  const effectiveStart = new Date(Math.max(startDate.getTime(), template.startDate.getTime()));
  const effectiveEnd = template.endDate
    ? new Date(Math.min(endDate.getTime(), template.endDate.getTime()))
    : endDate;

  let currentDate = findFirstOccurrence(template, effectiveStart);

  while (currentDate <= effectiveEnd) {
    const instanceKey = formatInstanceKey(currentDate);
    const override = overrides.find((o) => o.instanceKey === instanceKey);

    if (!override || override.action !== 'skip') {
      occurrences.push({
        templateId: template.id,
        date: new Date(currentDate),
        instanceKey,
        amount: override?.amount ?? template.amount,
        categoryId: override?.categoryId ?? template.defaultCategoryId,
        description: override?.description ?? template.description ?? template.name,
        merchant: template.merchant,
        direction: template.direction,
        isOverridden: !!override,
        isSkipped: false,
      });
    }

    currentDate = getNextOccurrence(template, currentDate);

    // Safety check to prevent infinite loops
    if (occurrences.length > 1000) break;
  }

  return occurrences;
}

/**
 * Expand recurring templates for a specific month
 */
export function expandRecurringToMonth(
  template: RecurringTransactionTemplate,
  year: number,
  month: number,
  overrides: RecurringOverride[] = []
): RecurringOccurrence[] {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month
  return expandRecurringToRange(template, startDate, endDate, overrides);
}

/**
 * Find the first occurrence on or after a given start date
 */
function findFirstOccurrence(template: RecurringTransactionTemplate, afterDate: Date): Date {
  let current = new Date(template.startDate);

  // Fast-forward to near the afterDate
  while (current < afterDate) {
    const next = getNextOccurrence(template, current);
    if (next >= afterDate) {
      return next;
    }
    current = next;
  }

  return current;
}

/**
 * Get the next occurrence after a given date
 */
function getNextOccurrence(template: RecurringTransactionTemplate, fromDate: Date): Date {
  const next = new Date(fromDate);

  switch (template.frequency) {
    case 'daily':
      next.setDate(next.getDate() + template.interval);
      break;

    case 'weekly':
      next.setDate(next.getDate() + 7 * template.interval);
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + template.interval);
      // Handle day of month
      if (template.byMonthDay) {
        const targetDay = Math.min(
          template.byMonthDay,
          daysInMonth(next.getFullYear(), next.getMonth())
        );
        next.setDate(targetDay);
      }
      break;

    case 'yearly':
      next.setFullYear(next.getFullYear() + template.interval);
      break;
  }

  return next;
}

/**
 * Get days in a month
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Format a date as YYYY-MM-DD for instance key
 */
function formatInstanceKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate missing occurrences that haven't been created as transactions yet
 */
export function generateMissingOccurrences(
  template: RecurringTransactionTemplate,
  existingInstanceKeys: Set<string>,
  upToDate: Date,
  overrides: RecurringOverride[] = []
): RecurringOccurrence[] {
  const allOccurrences = expandRecurringToRange(template, template.startDate, upToDate, overrides);

  return allOccurrences.filter(
    (occ) => !existingInstanceKeys.has(`${template.id}_${occ.instanceKey}`)
  );
}

/**
 * Calculate the next run date for a template
 */
export function calculateNextRunAt(
  template: RecurringTransactionTemplate,
  fromDate: Date = new Date()
): Date | null {
  if (!template.isActive) return null;
  if (template.endDate && fromDate > template.endDate) return null;

  const effectiveFrom = new Date(Math.max(fromDate.getTime(), template.startDate.getTime()));

  // If startDate is in the future, that's the next run
  if (template.startDate > fromDate) {
    return template.startDate;
  }

  return getNextOccurrence(template, effectiveFrom);
}

/**
 * Validate a recurring template schedule
 */
export function validateRecurringSchedule(
  template: Partial<RecurringTransactionTemplate>
): string[] {
  const errors: string[] = [];

  if (!template.frequency) {
    errors.push('Frequency is required');
  }

  if (template.interval !== undefined && template.interval < 1) {
    errors.push('Interval must be at least 1');
  }

  if (template.frequency === 'monthly' && template.byMonthDay) {
    if (template.byMonthDay < 1 || template.byMonthDay > 31) {
      errors.push('Day of month must be between 1 and 31');
    }
  }

  if (template.frequency === 'weekly' && template.byWeekday) {
    const days = template.byWeekday.split(',').map(Number);
    if (days.some((d) => isNaN(d) || d < 0 || d > 6)) {
      errors.push('Weekday must be between 0 (Sunday) and 6 (Saturday)');
    }
  }

  if (template.endDate && template.startDate && template.endDate < template.startDate) {
    errors.push('End date must be after start date');
  }

  return errors;
}

/**
 * Get a human-readable description of the schedule
 */
export function getScheduleDescription(template: RecurringTransactionTemplate): string {
  const intervalText = template.interval === 1 ? '' : `every ${template.interval} `;

  switch (template.frequency) {
    case 'daily':
      return template.interval === 1 ? 'Daily' : `Every ${template.interval} days`;

    case 'weekly': {
      if (template.byWeekday) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNames = template.byWeekday
          .split(',')
          .map((d) => days[Number.parseInt(d)] ?? d)
          .join(', ');
        return `${intervalText}Weekly on ${dayNames}`;
      }
      return template.interval === 1 ? 'Weekly' : `Every ${template.interval} weeks`;
    }

    case 'monthly':
      if (template.byMonthDay) {
        const suffix = getOrdinalSuffix(template.byMonthDay);
        return `${intervalText}Monthly on the ${template.byMonthDay}${suffix}`;
      }
      return template.interval === 1 ? 'Monthly' : `Every ${template.interval} months`;

    case 'yearly':
      return template.interval === 1 ? 'Yearly' : `Every ${template.interval} years`;

    default:
      return 'Unknown schedule';
  }
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0] || 'th';
}
