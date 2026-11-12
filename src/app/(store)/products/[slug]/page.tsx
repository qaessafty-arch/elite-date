import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/store/ProductCard';
import { ProductView } from '@/components/store/ProductView';
import { RecentlyViewed } from '@/components/store/RecentlyViewed';
import { ReviewForm } from '@/components/store/ReviewForm';
import { Stars } from '@/components/store/Stars';
import { getCurrentUser } from '@/lib/auth';
import { getProductBySlug, getProductReviews, getRelatedProducts } from '@/lib/catalog';
import { formatMoney } from '@/lib/money';
import { listShippingMethods } from '@/lib/orders';
import { getSettings, siteUrl } from '@/lib/settings';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ color?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  const image = product.images[0]?.url;
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: product.name, description: product.description.slice(0, 160), images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ slug }, { color }] = await Promise.all([params, searchParams]);
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [reviews, related, methods, settings, user] = await Promise.all([
    getProductReviews(product.id),
    getRelatedProducts(product.id, 4),
    listShippingMethods(),
    getSettings(),
    getCurrentUser(),
  ]);
  const { currency, locale } = settings.locale;
  const money = (c: number) => formatMoney(c, currency, locale);
  const type = product.categories.find((c) => c.kind === 'type');
  const anyDemo = reviews.some((r) => r.isDemo);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images.map((i) => siteUrl() + i.url),
    sku: product.variants[0]?.sku,
    brand: { '@type': 'Brand', name: product.brand },
    material: product.material || undefined,
    offers: {
      '@type': 'Offer',
      url: `${siteUrl()}/products/${product.slug}`,
      priceCurrency: currency,
      price: (product.priceCents / 100).toFixed(2),
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    // Ratings are only published as structured data when they come from real customers.
    ...(product.rating.count > 0 && !anyDemo
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating.average.toFixed(1), reviewCount: product.rating.count } }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="shell pt-6 md:pt-8">
        <nav aria-label="Breadcrumb" className="small mb-5 text-mute">
          <ol className="flex flex-wrap gap-x-2">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            <li className="flex gap-x-2">
              <span aria-hidden="true">/</span>
              <Link href="/shop" className="hover:text-ink">
                Shop
              </Link>
            </li>
            {type && (
              <li className="flex gap-x-2">
                <span aria-hidden="true">/</span>
                <Link href={`/c/${type.slug}`} className="hover:text-ink">
                  {type.name}
                </Link>
              </li>
            )}
            <li className="flex gap-x-2 text-ink" aria-current="page">
              <span aria-hidden="true">/</span>
              {product.name}
            </li>
          </ol>
        </nav>

        <ProductView
          product={product}
          initialColor={color}
          shipping={methods.map((m) => ({
            name: m.name,
            days: m.min_days === m.max_days ? String(m.min_days) : `${m.min_days} to ${m.max_days}`,
            price: money(m.price_cents),
            freeOver: m.free_over_cents !== null ? money(m.free_over_cents) : null,
          }))}
        />
      </div>

      {/* Reviews */}
      <section id="reviews" aria-labelledby="reviews-heading" className="shell scroll-mt-24 pt-20 md:pt-28">
        <div className="grid gap-10 border-t border-ink pt-8 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="reviews-heading" className="display display-md">
              Reviews
            </h2>
            {product.rating.count > 0 ? (
              <p className="mt-4 flex items-center gap-3">
                <Stars rating={product.rating.average} />
                <span>
                  <strong className="font-semibold">{product.rating.average.toFixed(1)}</strong> from {product.rating.count}{' '}
                  {product.rating.count === 1 ? 'review' : 'reviews'}
                </span>
              </p>
            ) : (
              <p className="mt-3 text-mute">No reviews yet. Be the first to write one.</p>
            )}
            {anyDemo && (
              <p className="small mt-3 max-w-xs text-mute">
                Reviews marked “sample” were written for this demonstration store and are not from real customers.
              </p>
            )}
            <div className="mt-8">
              {user ? (
                <details>
                  <summary className="btn btn-secondary inline-flex list-none [&::-webkit-details-marker]:hidden">Write a review</summary>
                  <div className="mt-5">
                    <ReviewForm productId={product.id} />
                  </div>
                </details>
              ) : (
                <Link href={`/account/login?next=${encodeURIComponent(`/products/${product.slug}#reviews`)}`} className="btn btn-secondary">
                  Sign in to write a review
                </Link>
              )}
            </div>
          </div>
          <ul className="grid gap-8 md:col-span-8">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-line pb-8 last:border-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Stars rating={r.rating} size={14} />
                  <p className="font-semibold">{r.title}</p>
                </div>
                <p className="mt-2 max-w-prose text-mute">{r.body}</p>
                <p className="small mt-3 text-mute">
                  <span className="font-semibold text-ink">{r.authorName}</span>
                  {r.isVerifiedPurchase && <span className="ml-2 text-ok">Verified purchase</span>}
                  {r.isDemo && <span className="tag ml-2 border border-line-strong">Sample</span>}
                  <span className="ml-2">{r.createdAt.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="shell pt-20 md:pt-28">
          <h2 id="related-heading" className="display display-md mb-8">
            Wear it with
          </h2>
          <ProductGrid products={related} />
        </section>
      )}

      <RecentlyViewed excludeId={product.id} />
    </>
  );
}
