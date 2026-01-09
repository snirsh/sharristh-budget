import { NextResponse } from 'next/server';
import { prisma } from '@sfam/db';
import { auth } from '@/lib/auth';

/**
 * Debug endpoint to diagnose transaction date issues
 * Access at: /api/debug/transactions
 * 
 * Shows:
 * - Transaction counts by date (Israel timezone vs UTC)
 * - Recent sync job results
 * - Most recent transactions with raw dates
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's household
    const membership = await prisma.householdMember.findFirst({
      where: { userId: session.user.id },
      select: { householdId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No household found' }, { status: 404 });
    }

    const householdId = membership.householdId;

    // Get all transactions for this household
    const transactions = await prisma.transaction.findMany({
      where: { householdId },
      select: {
        id: true,
        date: true,
        description: true,
        externalId: true,
        isIgnored: true,
        createdAt: true,
      },
      orderBy: { date: 'desc' },
    });

    // Group by date (Israel timezone)
    const byDateIsrael: Record<string, number> = {};
    const byDateUTC: Record<string, number> = {};

    for (const tx of transactions) {
      // Format in Israel timezone
      const israelDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(tx.date);

      // UTC date
      const utcDate = tx.date.toISOString().split('T')[0]!;

      byDateIsrael[israelDate] = (byDateIsrael[israelDate] || 0) + 1;
      byDateUTC[utcDate] = (byDateUTC[utcDate] || 0) + 1;
    }

    // Get bank connections
    const connections = await prisma.bankConnection.findMany({
      where: { householdId },
      select: {
        id: true,
        displayName: true,
        provider: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        isActive: true,
      },
    });

    // Get recent sync jobs
    const syncJobs = await prisma.syncJob.findMany({
      where: {
        connection: { householdId },
      },
      include: {
        connection: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get last 20 transactions with full date info
    const recentTransactions = transactions.slice(0, 20).map(tx => ({
      id: tx.id.substring(0, 8),
      dateISO: tx.date.toISOString(),
      dateIsrael: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(tx.date),
      description: tx.description.substring(0, 50),
      externalId: tx.externalId?.substring(0, 30) || null,
      isIgnored: tx.isIgnored,
      createdAt: tx.createdAt.toISOString(),
    }));

    return NextResponse.json({
      diagnosis: {
        totalTransactions: transactions.length,
        uniqueDatesIsrael: Object.keys(byDateIsrael).length,
        uniqueDatesUTC: Object.keys(byDateUTC).length,
        dateRangeIsrael: {
          earliest: Object.keys(byDateIsrael).sort()[0] || null,
          latest: Object.keys(byDateIsrael).sort().pop() || null,
        },
        dateRangeUTC: {
          earliest: Object.keys(byDateUTC).sort()[0] || null,
          latest: Object.keys(byDateUTC).sort().pop() || null,
        },
      },
      transactionsByDateIsrael: Object.entries(byDateIsrael)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 30)
        .map(([date, count]) => ({ date, count })),
      transactionsByDateUTC: Object.entries(byDateUTC)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 30)
        .map(([date, count]) => ({ date, count })),
      connections: connections.map(c => ({
        displayName: c.displayName,
        provider: c.provider,
        lastSyncAt: c.lastSyncAt?.toISOString() || null,
        lastSyncStatus: c.lastSyncStatus,
        isActive: c.isActive,
      })),
      recentSyncJobs: syncJobs.map(job => ({
        connectionName: job.connection.displayName,
        status: job.status,
        startedAt: job.startedAt?.toISOString() || null,
        completedAt: job.completedAt?.toISOString() || null,
        transactionsFound: job.transactionsFound,
        transactionsNew: job.transactionsNew,
        errorMessage: job.errorMessage,
      })),
      recentTransactions,
      serverTime: {
        utc: new Date().toISOString(),
        israel: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Jerusalem',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()),
      },
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
