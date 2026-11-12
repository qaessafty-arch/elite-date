import Image from 'next/image';
import Link from 'next/link';
import { getFeaturedReviews, listCategories, listProducts } from '@/lib/catalog';
import { queryOne } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { getSettings } from '@/lib/settings';
import { HeroParallax } from '@/components/home/HeroParallax';
import { ClothStudy } from '@/components/home/ClothStudy';
import { ProductGrid } from '@/components/store/ProductCard';
import { Stars } from '@/components/store/Stars';

type Campaign = {
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  min_subtotal_cents: number;
  expires_at: Date | null;
};

export default async function HomePage() {
  const [settings, collections, featured, reviews, campaign, rating] = await Promise.all([
    getSettings(),
    listCategories('collection'),
    listProducts({ sort: 'featured', perPage: 8 }),
    getFeaturedReviews(3),
    // The promotional block only advertises a code that is live right now.
    queryOne<Campaign>(
      `select code::text as code, kind, value, min_subtotal_cents, expires_at from coupons
        where campaign = 'Low Sun' and is_active
          and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at > now())
          and (usage_limit is null or used_count < usage_limit)
        order by created_at desc limit 1`,
    ),
    queryOne<{ avg: string | null; count: number }>(
      `select avg(rating) as avg, count(*) as count from reviews where status = 'published'`,
    ),
  ]);
  const { currency, locale } = settings.locale;
  const money = (c: number) => formatMoney(c, currency, locale);
  const tiles = collections.filter((c) => c.isFeatured && c.imageUrl).slice(0, 6);
  const anyDemoReviews = reviews.some((r) => r.isDemo);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[34rem] flex-col justify-end overflow-hidden bg-loden text-on-dark md:h-[calc(100svh-var(--header-h)-2.5rem)] md:max-h-[58rem]">
        <HeroParallax>
          <Image
            src="/images/campaign/hero.jpg"
            alt="Two people in a camel overcoat and a loden chore jacket crossing a pale stone quarry at low sun"
            fill
            priority
            sizes="100vw"
            className="hero-media object-cover object-[72%_center] md:object-center"
          />
        </HeroParallax>
        <div className="absolute inset-0 -z-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent md:bg-gradient-to-r md:from-black/45 md:via-black/5" aria-hidden="true" />
        <div className="shell relative pb-10 pt-40 md:pb-16">
          <p className="rise label" style={{ '--i': 0 } as React.CSSProperties}>
            Autumn 2026 collection
          </p>
          <h1 className="rise display display-xl mt-3 max-w-[11ch]" style={{ '--i': 1 } as React.CSSProperties}>
            Cut for the low sun
          </h1>
          <p className="rise mt-5 max-w-md text-[1.0625rem] text-on-dark/85" style={{ '--i': 2 } as React.CSSProperties}>
            Wool overcoats, washed twill and heavy jersey, made in small runs from mill-end cloth.
          </p>
          <div className="rise mt-7 flex flex-wrap gap-3" style={{ '--i': 3 } as React.CSSProperties}>
            <Link href="/c/low-sun" className="btn btn-light">
              Shop the collection
            </Link>
            <Link href="/c/new-arrivals" className="btn btn-outline-light">
              See new arrivals
            </Link>
          </div>
        </div>
      </section>

      {/* Collections: a staggered three-column wall, portrait throughout */}
      <section aria-labelledby="collections-heading" className="shell pt-20 md:pt-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="collections-heading" className="display display-lg max-w-[14ch]">
            Six ways into the wardrobe
          </h2>
          <Link href="/collections" className="link font-medium">
            View all collections
          </Link>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 md:mt-14 md:grid-cols-3 md:gap-x-6 md:gap-y-16">
          {tiles.map((c, i) => (
            <li key={c.slug} className={i % 3 === 1 ? 'md:translate-y-16' : i % 3 === 2 ? 'md:translate-y-6' : ''}>
              <Link href={`/c/${c.slug}`} className="group block">
                <div className={`relative overflow-hidden bg-sand ${i % 3 === 1 ? 'aspect-[4/5]' : 'aspect-[3/4]'}`}>
                  <Image
                    src={c.imageUrl!}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 30vw, 48vw"
                    className="object-cover transition-transform duration-[900ms] ease-out-soft group-hover:scale-[1.04]"
                  />
                </div>
                <h3 className="display display-sm mt-4">{c.name}</h3>
                <p className="small mt-1 text-mute">{c.description}</p>
                <p className="mt-2 text-[0.9375rem] font-medium underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current">
                  Shop {c.name.split(',')[0].toLowerCase()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured products */}
      <section aria-labelledby="featured-heading" className="shell pt-28 md:pt-44">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
          <div>
            <h2 id="featured-heading" className="display display-lg">
              Worn most this season
            </h2>
            <p className="lede mt-3">The pieces customers reorder, and the new ones we think will join them.</p>
          </div>
          <Link href="/shop" className="link font-medium">
            Shop everything
          </Link>
        </div>
        <ProductGrid products={featured.products} />
      </section>

      {/* Brand story */}
      <section aria-labelledby="story-heading" className="shell grid gap-10 pt-24 md:grid-cols-12 md:gap-8 md:pt-36">
        <div className="relative md:col-span-6">
          <div className="relative aspect-[3/4] overflow-hidden bg-sand">
            <Image
              src="/images/campaign/atelier.jpg"
              alt="A pattern cutter chalking a line onto camel wool on a wooden table"
              fill
              sizes="(min-width: 768px) 46vw, 92vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-10 -right-4 hidden w-2/5 border-8 border-bone md:block lg:-right-12">
            <div className="relative aspect-square overflow-hidden bg-sand">
              <Image src="/images/campaign/cloth.jpg" alt="Folded wool, twill and selvedge denim" fill sizes="20vw" className="object-cover" />
            </div>
          </div>
        </div>
        <div className="md:col-span-5 md:col-start-8 md:pt-10">
          <h2 id="story-heading" className="display display-lg">
            Clothes cut to be kept
          </h2>
          <p className="lede mt-5">
            {settings.brand.name} started with a question at a cutting table: what would we make if nothing had to be new
            next season? The answer is a small wardrobe that we refine rather than replace.
          </p>
          <dl className="mt-8 grid gap-6">
            {[
              ['Mill-end cloth', 'We buy the last metres of exceptional rolls from mills in Biella, Prato and Okayama. Good cloth that would otherwise sit in a warehouse.'],
              ['Small runs', 'Most styles are cut in runs of 300 or fewer, in workshops we visit in Portugal and northern Italy.'],
              ['Made to mend', 'Seams are generous, buttons are sewn on shanks, and soles are stitched so a cobbler can replace them.'],
            ].map(([term, detail]) => (
              <div key={term} className="border-t border-line pt-4">
                <dt className="font-semibold">{term}</dt>
                <dd className="mt-1 text-mute">{detail}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/c/essentials" className="btn btn-primary">
              Discover the essentials
            </Link>
            <Link href="/about" className="btn btn-secondary">
              Read our story
            </Link>
          </div>
        </div>
      </section>

      {/* Material study: procedural 3D cloth, loaded only when scrolled near */}
      <ClothStudy />

      {/* Seasonal campaign */}
      <section aria-labelledby="campaign-heading" className="mt-24 bg-loden text-on-dark md:mt-32">
        <div className="grid md:grid-cols-12">
          <div className="relative min-h-[22rem] md:order-2 md:col-span-7 md:min-h-[38rem]">
            <Image
              src="/images/campaign/low-sun.jpg"
              alt="Two people in a quilted vest and a trench coat sitting on concrete steps at dusk"
              fill
              sizes="(min-width: 768px) 58vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center px-5 py-14 md:col-span-5 md:px-10 lg:px-16">
            <p className="label text-brass">The autumn campaign</p>
            <h2 id="campaign-heading" className="display mt-3 text-[clamp(3.5rem,8vw,7.5rem)] italic leading-[0.9]">
              Low Sun
            </h2>
            <p className="mt-6 max-w-sm text-on-dark/80">
              Shot over two evenings in the last hour of light. Coats that hold their line, layers that come off indoors.
            </p>
            {campaign && (
              <p className="mt-6 max-w-sm border-l border-brass pl-4">
                {campaign.kind === 'percent' ? `${campaign.value}%` : money(campaign.value)} off
                {campaign.min_subtotal_cents > 0 ? ` orders over ${money(campaign.min_subtotal_cents)}` : ' your order'} with code{' '}
                <strong className="font-semibold tracking-wide text-brass">{campaign.code}</strong>
                {campaign.expires_at
                  ? `, until ${campaign.expires_at.toLocaleDateString(locale, { month: 'long', day: 'numeric' })}.`
                  : '.'}
              </p>
            )}
            <div className="mt-8">
              <Link href="/c/low-sun" className="btn btn-light">
                Shop Low Sun
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section aria-labelledby="reviews-heading" className="shell pt-24 md:pt-32">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-4">
              <h2 id="reviews-heading" className="display display-lg">
                What customers say
              </h2>
              {rating?.avg && (
                <p className="mt-5 flex items-center gap-3">
                  <Stars rating={Number(rating.avg)} />
                  <span>
                    <strong className="font-semibold">{Number(rating.avg).toFixed(1)}</strong> out of 5 from {rating.count} reviews
                  </span>
                </p>
              )}
              {anyDemoReviews && (
                <p className="small mt-4 max-w-xs text-mute">
                  These are sample reviews written for this demonstration store. They are not from real customers.
                </p>
              )}
            </div>
            <ul className="grid gap-8 md:col-span-8 md:grid-cols-3 md:gap-6">
              {reviews.map((r) => (
                <li key={r.id} className="flex flex-col border-t border-ink pt-5">
                  <Stars rating={r.rating} />
                  <blockquote className="mt-4 flex-1">
                    <p className="display text-[1.3125rem] leading-snug">{r.title}</p>
                    <p className="mt-3 text-[0.9375rem] text-mute">{r.body}</p>
                  </blockquote>
                  <footer className="small mt-5">
                    <p className="font-semibold">{r.authorName}</p>
                    <p className="text-mute">
                      {r.isVerifiedPurchase ? 'Verified purchase' : 'Review'} of{' '}
                      <Link href={`/products/${r.productSlug}`} className="underline underline-offset-2 hover:text-ink">
                        {r.productName}
                      </Link>
                    </p>
                  </footer>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
