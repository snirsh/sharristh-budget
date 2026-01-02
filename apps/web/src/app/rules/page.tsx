import { serverTrpc } from '@/lib/trpc/server';
import { RulesContent } from '@/components/rules/RulesContent';

// ISR: Revalidate every hour for rules (rarely change)
export const revalidate = 3600;

export default async function RulesPage() {
  const trpc = await serverTrpc();
  const categories = await trpc.categories.list();

  return <RulesContent categories={categories} />;
}

