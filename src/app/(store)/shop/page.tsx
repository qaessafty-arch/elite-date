import type { Metadata } from 'next';
import { Catalogue } from '@/components/store/Catalogue';
import type { RawParams } from '@/lib/catalog-params';

export const metadata: Metadata = {
  title: 'Shop everything',
  description: 'The full Halden range: outerwear, shirting, denim, knitwear, shoes and accessories.',
  alternates: { canonical: '/shop' },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <Catalogue
      title="Shop everything"
      description="The whole wardrobe in one place. Filter by fit, cloth or colour."
      searchParams={await searchParams}
      basePath="/shop"
    />
  );
}
