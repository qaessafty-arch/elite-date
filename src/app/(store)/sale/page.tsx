import type { Metadata } from 'next';
import { Catalogue } from '@/components/store/Catalogue';
import type { RawParams } from '@/lib/catalog-params';

export const metadata: Metadata = {
  title: 'Sale',
  description: 'Past-season pieces at reduced prices while sizes last.',
  alternates: { canonical: '/sale' },
};

export default async function SalePage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <Catalogue
      title="Sale"
      description="Past-season pieces at reduced prices, while sizes last. Sale items can be returned within 30 days like everything else."
      searchParams={await searchParams}
      basePath="/sale"
      preset={{ onSale: true }}
      locked={['sale']}
      breadcrumb={[{ label: 'Shop', href: '/shop' }]}
    />
  );
}
