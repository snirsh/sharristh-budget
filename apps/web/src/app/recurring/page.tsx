import { RecurringContent } from '@/components/recurring/RecurringContent';

// ISR: Revalidate every 10 minutes for recurring templates (infrequent changes)
export const revalidate = 600;

export default async function RecurringPage() {
  return <RecurringContent />;
}

