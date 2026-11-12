import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Catalogue } from '@/components/store/Catalogue';
import { getCategoryBySlug } from '@/lib/catalog';
import type { RawParams } from '@/lib/catalog-params';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).slug);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/c/${category.slug}` },
    openGraph: category.imageUrl ? { images: [category.imageUrl] } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await getCategoryBySlug((await params).slug);
  if (!category) notFound();
  return (
    <Catalogue
      title={category.name}
      description={category.description}
      searchParams={await searchParams}
      basePath={`/c/${category.slug}`}
      preset={{ [category.kind]: [category.slug] }}
      locked={[category.kind]}
      breadcrumb={category.kind === 'collection' ? [{ label: 'Collections', href: '/collections' }] : [{ label: 'Shop', href: '/shop' }]}
    />
  );
}
