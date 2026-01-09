import { serverTrpc } from '@/lib/trpc/server';
import { redirect } from 'next/navigation';
import { TransactionsClient } from './TransactionsClient';

type TransactionsServerProps = {
  month?: string;
  needsReview?: boolean;
};

export async function TransactionsServer({ month, needsReview = false }: TransactionsServerProps) {
  const trpc = await serverTrpc();

  try {
    // Pre-fetch categories on the server
    const categories = await trpc.categories.list();

    // Pass pre-fetched data to client component
    return (
      <TransactionsClient
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
