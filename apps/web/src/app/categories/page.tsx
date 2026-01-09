import { CategoriesContent } from '@/components/categories/CategoriesContent';

// Force dynamic rendering - database queries can't run at build time
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  return <CategoriesContent />;
}
