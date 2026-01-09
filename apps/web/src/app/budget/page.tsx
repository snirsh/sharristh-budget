import { Suspense } from 'react';
import { BudgetContent } from '@/components/budget/BudgetContent';
import { Loader2 } from 'lucide-react';

// Force dynamic rendering - database queries can't run at build time
export const dynamic = 'force-dynamic';

const Loading = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
    <span className="ml-2 text-gray-500 dark:text-gray-400">Loading budgets...</span>
  </div>
);

export default function BudgetPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BudgetContent />
    </Suspense>
  );
}

