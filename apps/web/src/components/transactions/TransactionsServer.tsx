import { serverTrpc } from '@/lib/trpc/server';
import { TransactionsClient } from './TransactionsClient';
import { redirect } from 'next/navigation';

type TransactionsServerProps = {
  month: string;
  needsReview?: boolean;
};

export async function TransactionsServer({ month, needsReview = false }: TransactionsServerProps) {
  const trpc = await serverTrpc();

  try {
    // Calculate date range for the month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year!, monthNum! - 1, 1);
    const endDate = new Date(year!, monthNum!, 0, 23, 59, 59, 999);

    // Pre-fetch transactions and categories on the server
    const [transactionsData, categories] = await Promise.all([
      trpc.transactions.list({
        limit: 30,
        offset: 0,
        startDate,
        endDate,
        needsReview: needsReview || undefined,
      }),
      trpc.categories.list(),
    ]);

    // Pass pre-fetched data to client component
    return (
      <TransactionsClient
        initialTransactions={transactionsData}
        categories={categories}
        initialNeedsReview={needsReview}
        initialMonth={month}
      />
    );
  } catch (error) {
    // If unauthorized, redirect to login
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      redirect('/login');
    }
    throw error;
  }
}
