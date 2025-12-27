import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'ILS'): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year ?? '2024'), parseInt(monthNum ?? '1') - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'ok':
      return 'badge-success';
    case 'nearing_limit':
      return 'badge-warning';
    case 'exceeded_soft':
      return 'badge-warning';
    case 'exceeded_hard':
      return 'badge-danger';
    default:
      return 'badge-gray';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'ok':
      return 'On Track';
    case 'nearing_limit':
      return 'Nearing Limit';
    case 'exceeded_soft':
      return 'Over Budget';
    case 'exceeded_hard':
      return 'Exceeded';
    case 'no_budget':
      return 'No Budget';
    default:
      return status;
  }
}

