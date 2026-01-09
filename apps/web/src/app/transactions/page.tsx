import { Suspense } from 'react';
import { TransactionsServer } from '@/components/transactions/TransactionsServer';
import { Loader2 } from 'lucide-react';
import { getCurrentMonth } from '@/lib/utils';

// Force dynamic rendering - database queries can't run at build time
export const dynamic = 'force-dynamic';

const Loading = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
    <span className="ml-2 text-gray-500 dark:text-gray-400">Loading transactions...</span>
  </div>
);

const TransactionsPageContent = async ({
  searchParams,
}: {
  searchParams: Promise<{ needsReview?: string; month?: string }>;
}) => {
  const params = await searchParams;
  const needsReview = params.needsReview === 'true';
  // When needsReview is true and no month is explicitly set, don't filter by month (show all time)
  const month = params.month ?? (needsReview ? undefined : getCurrentMonth());

  return (
    <TransactionsServer
      month={month}
      needsReview={needsReview}
    />
  );
};

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ needsReview?: string; month?: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <TransactionsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

