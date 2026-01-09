'use client';

import { useMonth } from '@/lib/useMonth';
import { formatMonth } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const MonthSelector = () => {
  const { currentMonth, navigateMonth } = useMonth();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigateMonth('prev')}
        className="btn-outline btn-sm"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-lg font-medium min-w-[160px] text-center">
        {formatMonth(currentMonth)}
      </span>
      <button
        onClick={() => navigateMonth('next')}
        className="btn-outline btn-sm"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
