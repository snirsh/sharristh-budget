import { serverTrpc } from '@/lib/trpc/server';
import { DashboardClient } from './DashboardClient';
import { redirect } from 'next/navigation';

type DashboardServerProps = {
  month?: string;
};

export async function DashboardServer({ month }: DashboardServerProps) {
  const trpc = await serverTrpc();

  // Get current month if not provided
  const currentMonth = month || new Date().toISOString().slice(0, 7);

  try {
    // Pre-fetch dashboard data on the server
    const dashboardData = await trpc.dashboard.getFullDashboard({
      month: currentMonth,
      recentLimit: 5,
    });

    // Pass pre-fetched data to client component
    return (
      <DashboardClient
        initialData={dashboardData}
        initialMonth={currentMonth}
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
