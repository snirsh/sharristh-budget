import { BudgetContent } from '@/components/budget/BudgetContent';
import { getCurrentMonth } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BudgetPage() {
  const month = getCurrentMonth();

  return <BudgetContent month={month} />;
}

