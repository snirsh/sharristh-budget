import { serverTrpc } from '@/lib/trpc/server';
import { RulesContent } from '@/components/rules/RulesContent';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const categories = await serverTrpc.categories.list();

  return <RulesContent categories={categories} />;
}

