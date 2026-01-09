import { RulesContent } from '@/components/rules/RulesContent';
import { serverTrpc } from '@/lib/trpc/server';

// Force dynamic rendering - database queries can't run at build time
export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const trpc = await serverTrpc();
  const categories = await trpc.categories.list();

  return <RulesContent categories={categories} />;
}
