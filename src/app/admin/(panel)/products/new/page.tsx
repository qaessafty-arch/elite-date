import Link from 'next/link';
import { PageHeader, Panel } from '@/components/admin/parts';
import { ProductForm } from '@/components/admin/ProductForm';
import { adminCategories } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Add a product' };

export default async function NewProductPage() {
  await requireAdmin('products.manage');
  const categories = await adminCategories();
  return (
    <>
      <PageHeader title="Add a product" description="Save the details first. You can then add colours, sizes, stock and images." actions={<Link href="/admin/products" className="btn btn-secondary btn-sm">Back to products</Link>} />
      <Panel className="max-w-4xl">
        <ProductForm categories={categories} selected={[]} />
      </Panel>
    </>
  );
}
