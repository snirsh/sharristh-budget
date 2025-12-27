import { serverTrpc } from '@/lib/trpc/server';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { getCurrentMonth } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const month = getCurrentMonth();
  const trpc = await serverTrpc();
  
  const [overview, categoryBreakdown, recentTransactions] = await Promise.all([
    trpc.dashboard.overview(month),
    trpc.dashboard.categoryBreakdown(month),
    trpc.dashboard.recentTransactions({ limit: 5 }),
  ]);

  return (
    <DashboardContent
      month={month}
      overview={overview}
      categoryBreakdown={categoryBreakdown}
      recentTransactions={recentTransactions}
    />
  );
}

