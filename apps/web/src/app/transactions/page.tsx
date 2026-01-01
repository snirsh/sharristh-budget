import { Suspense } from 'react';
import { serverTrpc } from '@/lib/trpc/server';
import { TransactionsContent } from '@/components/transactions/TransactionsContent';
import { Loader2 } from 'lucide-react';
import { getCurrentMonth } from '@/lib/utils';

// ISR: Revalidate every 30 seconds for transaction data
export const revalidate = 30;

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
  const month = params.month ?? getCurrentMonth();
  const trpc = await serverTrpc();
  const categories = await trpc.categories.list();

  return (
    <TransactionsContent
      categories={categories}
      initialNeedsReview={needsReview}
      month={month}
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

