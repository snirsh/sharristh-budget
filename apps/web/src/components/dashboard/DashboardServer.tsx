import { serverTrpc } from '@/lib/trpc/server';
import { redirect } from 'next/navigation';
import { DashboardClient } from './DashboardClient';

type DashboardServerProps = {
  month?: string;
};

export async function DashboardServer({ month }: DashboardServerProps) {
  const trpc = await serverTrpc();

  // Get current month if not provided
  const currentMonth = month || new Date().toISOString().slice(0, 7);

  try {
    // Pre-fetch dashboard data and expense insights in parallel
    const [dashboardData, insightsData] = await Promise.all([
      trpc.dashboard.getFullDashboard({
        month: currentMonth,
        recentLimit: 5,
      }),
      trpc.dashboard.getExpenseInsights({
        month: currentMonth,
      }),
    ]);

    // Pass pre-fetched data to client component
    return (
      <DashboardClient
        initialData={dashboardData}
        initialMonth={currentMonth}
        initialInsights={insightsData}
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
