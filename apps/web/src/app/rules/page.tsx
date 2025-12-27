import { serverTrpc } from '@/lib/trpc/server';
import { RulesContent } from '@/components/rules/RulesContent';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const trpc = await serverTrpc();
  const categories = await trpc.categories.list();

  return <RulesContent categories={categories} />;
}

