import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { listCategories } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Edits of the Halden range: new arrivals, best sellers, the autumn collection, streetwear, essentials and limited editions.',
  alternates: { canonical: '/collections' },
};

export default async function CollectionsPage() {
  const collections = await listCategories('collection');
  return (
    <div className="shell pb-10 pt-8 md:pt-12">
      <h1 className="display display-lg">Collections</h1>
      <p className="lede mt-3">Different ways to read the same wardrobe.</p>
      <ul className="mt-10 grid gap-x-6 gap-y-14 sm:grid-cols-2">
        {collections.map((c, i) => (
          <li key={c.slug} className={i % 2 === 1 ? 'sm:mt-20' : ''}>
            <Link href={`/c/${c.slug}`} className="group grid gap-5">
              <div className="relative aspect-[4/5] overflow-hidden bg-sand">
                {c.imageUrl && (
                  <Image
                    src={c.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 46vw, 92vw"
                    priority={i < 2}
                    className="object-cover transition-transform duration-[900ms] ease-out-soft group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <div className="flex items-end justify-between gap-6">
                <div>
                  <h2 className="display display-md">{c.name}</h2>
                  <p className="mt-1 text-mute">{c.description}</p>
                </div>
                <p className="small shrink-0 text-mute">
                  {c.productCount} {c.productCount === 1 ? 'piece' : 'pieces'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
