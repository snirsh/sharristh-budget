import { CategoriesContent } from '@/components/categories/CategoriesContent';

// ISR: Revalidate every hour for categories (rarely change)
export const revalidate = 3600;

export default async function CategoriesPage() {
  return <CategoriesContent />;
}

