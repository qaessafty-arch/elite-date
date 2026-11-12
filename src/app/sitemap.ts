import type { MetadataRoute } from 'next';
import { query } from '@/lib/db';
import { siteUrl } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, categories] = await Promise.all([
    query<{ slug: string; updated_at: Date }>(`select slug, updated_at from products where status = 'published'`),
    query<{ slug: string }>('select slug from categories where is_active'),
  ]);
  const fixed = ['', '/shop', '/sale', '/collections', '/about', '/help/shipping', '/help/returns', '/help/size-guide', '/help/contact', '/help/privacy', '/help/terms'];
  return [
    ...fixed.map((p) => ({ url: base + p, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 })),
    ...categories.map((c) => ({ url: `${base}/c/${c.slug}`, changeFrequency: 'daily' as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updated_at, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
