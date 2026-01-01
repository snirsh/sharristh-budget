'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { getCurrentMonth } from './utils';

export const useMonth = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const currentMonth = useMemo(() => {
    return searchParams.get('month') || getCurrentMonth();
  }, [searchParams]);

  const setMonth = useCallback(
    (month: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('month', month);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const navigateMonth = useCallback(
    (direction: 'prev' | 'next') => {
      const [year, monthNum] = currentMonth.split('-').map(Number);
      const date = new Date(year!, monthNum! - 1);
      date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
      const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      setMonth(newMonth);
    },
    [currentMonth, setMonth]
  );

  const { startDate, endDate } = useMemo(() => {
    const [year, monthNum] = currentMonth.split('-').map(Number);
    return {
      startDate: new Date(year!, monthNum! - 1, 1),
      endDate: new Date(year!, monthNum!, 0, 23, 59, 59, 999), // End of last day of month
    };
  }, [currentMonth]);

  return {
    currentMonth,
    setMonth,
    navigateMonth,
    startDate,
    endDate,
  };
};

