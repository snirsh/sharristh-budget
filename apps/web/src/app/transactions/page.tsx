import { serverTrpc } from '@/lib/trpc/server';
import { TransactionsContent } from '@/components/transactions/TransactionsContent';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ needsReview?: string }>;
}) {
  const params = await searchParams;
  const needsReview = params.needsReview === 'true';
  const trpc = await serverTrpc();
  const categories = await trpc.categories.list();

  return (
    <TransactionsContent
      categories={categories}
      initialNeedsReview={needsReview}
    />
  );
}

