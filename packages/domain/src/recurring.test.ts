import { describe, expect, it } from 'vitest';
import {
  calculateNextRunAt,
  expandRecurringToMonth,
  expandRecurringToRange,
  getScheduleDescription,
  validateRecurringSchedule,
} from './recurring';
import type { RecurringOverride, RecurringTransactionTemplate } from './types';

describe('expandRecurringToMonth', () => {
  const monthlyTemplate: RecurringTransactionTemplate = {
    id: 'template-1',
    householdId: 'h1',
    name: 'Monthly Rent',
    direction: 'expense',
    amount: 5000,
    defaultCategoryId: 'cat-rent',
    description: 'Apartment rent',
    merchant: 'Landlord',
    frequency: 'monthly',
    interval: 1,
    byMonthDay: 1,
    startDate: new Date('2024-01-01'),
    timezone: 'Asia/Jerusalem',
    isActive: true,
  };

  it('should generate monthly occurrence on specified day', () => {
    const occurrences = expandRecurringToMonth(monthlyTemplate, 2024, 12);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.date.getDate()).toBe(1);
    expect(occurrences[0]?.date.getMonth()).toBe(11); // December (0-indexed)
    expect(occurrences[0]?.amount).toBe(5000);
    expect(occurrences[0]?.instanceKey).toBe('2024-12-01');
  });

  it('should not generate occurrences before start date', () => {
    const futureTemplate: RecurringTransactionTemplate = {
      ...monthlyTemplate,
      startDate: new Date('2025-06-01'),
    };

    const occurrences = expandRecurringToMonth(futureTemplate, 2024, 12);

    expect(occurrences).toHaveLength(0);
  });

  it('should not generate occurrences after end date', () => {
    const endedTemplate: RecurringTransactionTemplate = {
      ...monthlyTemplate,
      endDate: new Date('2024-06-01'),
    };

    const occurrences = expandRecurringToMonth(endedTemplate, 2024, 12);

    expect(occurrences).toHaveLength(0);
  });

  it('should not generate for inactive templates', () => {
    const inactiveTemplate: RecurringTransactionTemplate = {
      ...monthlyTemplate,
      isActive: false,
    };

    const occurrences = expandRecurringToMonth(inactiveTemplate, 2024, 12);

    expect(occurrences).toHaveLength(0);
  });

  it('should apply overrides to occurrences', () => {
    const overrides: RecurringOverride[] = [
      {
        id: 'override-1',
        templateId: 'template-1',
        instanceKey: '2024-12-01',
        action: 'modify',
        amount: 5500, // Increased rent
      },
    ];

    const occurrences = expandRecurringToMonth(monthlyTemplate, 2024, 12, overrides);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.amount).toBe(5500);
    expect(occurrences[0]?.isOverridden).toBe(true);
  });

  it('should skip occurrences with skip override', () => {
    const overrides: RecurringOverride[] = [
      {
        id: 'override-1',
        templateId: 'template-1',
        instanceKey: '2024-12-01',
        action: 'skip',
      },
    ];

    const occurrences = expandRecurringToMonth(monthlyTemplate, 2024, 12, overrides);

    expect(occurrences).toHaveLength(0);
  });
});

describe('expandRecurringToRange - weekly', () => {
  const weeklyTemplate: RecurringTransactionTemplate = {
    id: 'template-2',
    householdId: 'h1',
    name: 'Weekly Groceries',
    direction: 'expense',
    amount: 500,
    defaultCategoryId: 'cat-groceries',
    frequency: 'weekly',
    interval: 1,
    startDate: new Date('2024-12-01'),
    timezone: 'Asia/Jerusalem',
    isActive: true,
  };

  it('should generate weekly occurrences', () => {
    const occurrences = expandRecurringToRange(
      weeklyTemplate,
      new Date('2024-12-01'),
      new Date('2024-12-31')
    );

    // Should have ~4-5 occurrences in December
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
    expect(occurrences.length).toBeLessThanOrEqual(5);
  });

  it('should respect interval for bi-weekly', () => {
    const biWeeklyTemplate: RecurringTransactionTemplate = {
      ...weeklyTemplate,
      interval: 2,
    };

    const occurrences = expandRecurringToRange(
      biWeeklyTemplate,
      new Date('2024-12-01'),
      new Date('2024-12-31')
    );

    // Should have ~2 occurrences in December for bi-weekly
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    expect(occurrences.length).toBeLessThanOrEqual(3);
  });
});

describe('calculateNextRunAt', () => {
  const monthlyTemplate: RecurringTransactionTemplate = {
    id: 'template-1',
    householdId: 'h1',
    name: 'Monthly Payment',
    direction: 'expense',
    amount: 1000,
    frequency: 'monthly',
    interval: 1,
    byMonthDay: 15,
    startDate: new Date('2024-01-15'),
    timezone: 'Asia/Jerusalem',
    isActive: true,
  };

  it('should calculate next run for active template', () => {
    const fromDate = new Date('2024-12-10');
    const nextRun = calculateNextRunAt(monthlyTemplate, fromDate);

    expect(nextRun).not.toBeNull();
    expect(nextRun?.getDate()).toBe(15);
    // The month should be December (11) or January (0) depending on calculation
    expect([0, 11]).toContain(nextRun?.getMonth());
  });

  it('should return null for inactive template', () => {
    const inactiveTemplate = { ...monthlyTemplate, isActive: false };
    const nextRun = calculateNextRunAt(inactiveTemplate);

    expect(nextRun).toBeNull();
  });

  it('should return null if past end date', () => {
    const endedTemplate = { ...monthlyTemplate, endDate: new Date('2024-06-01') };
    const nextRun = calculateNextRunAt(endedTemplate, new Date('2024-12-01'));

    expect(nextRun).toBeNull();
  });
});

describe('getScheduleDescription', () => {
  it('should describe daily schedule', () => {
    const template: RecurringTransactionTemplate = {
      id: 't1',
      householdId: 'h1',
      name: 'Daily',
      direction: 'expense',
      amount: 10,
      frequency: 'daily',
      interval: 1,
      startDate: new Date(),
      timezone: 'UTC',
      isActive: true,
    };

    expect(getScheduleDescription(template)).toBe('Daily');
  });

  it('should describe monthly schedule with day', () => {
    const template: RecurringTransactionTemplate = {
      id: 't1',
      householdId: 'h1',
      name: 'Monthly',
      direction: 'expense',
      amount: 100,
      frequency: 'monthly',
      interval: 1,
      byMonthDay: 1,
      startDate: new Date(),
      timezone: 'UTC',
      isActive: true,
    };

    expect(getScheduleDescription(template)).toBe('Monthly on the 1st');
  });

  it('should describe bi-monthly schedule', () => {
    const template: RecurringTransactionTemplate = {
      id: 't1',
      householdId: 'h1',
      name: 'Bi-monthly',
      direction: 'expense',
      amount: 100,
      frequency: 'monthly',
      interval: 2,
      startDate: new Date(),
      timezone: 'UTC',
      isActive: true,
    };

    expect(getScheduleDescription(template)).toBe('Every 2 months');
  });
});

describe('validateRecurringSchedule', () => {
  it('should return no errors for valid schedule', () => {
    const template = {
      frequency: 'monthly' as const,
      interval: 1,
      byMonthDay: 15,
      startDate: new Date('2024-01-01'),
    };

    const errors = validateRecurringSchedule(template);

    expect(errors).toHaveLength(0);
  });

  it('should error on missing frequency', () => {
    const template = {
      interval: 1,
    };

    const errors = validateRecurringSchedule(template);

    expect(errors).toContain('Frequency is required');
  });

  it('should error on invalid interval', () => {
    const template = {
      frequency: 'monthly' as const,
      interval: 0,
    };

    const errors = validateRecurringSchedule(template);

    expect(errors).toContain('Interval must be at least 1');
  });

  it('should error on invalid byMonthDay', () => {
    const template = {
      frequency: 'monthly' as const,
      byMonthDay: 32,
    };

    const errors = validateRecurringSchedule(template);

    expect(errors).toContain('Day of month must be between 1 and 31');
  });

  it('should error on end date before start date', () => {
    const template = {
      frequency: 'monthly' as const,
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-01-01'),
    };

    const errors = validateRecurringSchedule(template);

    expect(errors).toContain('End date must be after start date');
  });
});
