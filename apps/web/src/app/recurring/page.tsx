import { RecurringContent } from '@/components/recurring/RecurringContent';

// Force dynamic rendering - database queries can't run at build time
export const dynamic = 'force-dynamic';

export default async function RecurringPage() {
  return <RecurringContent />;
}
