'use client';

import { useEffect, useState } from 'react';
import { recentlyViewedAction } from '@/app/actions/catalog';
import type { ProductCard as Product } from '@/lib/catalog';
import { ProductCard } from './ProductCard';

export function RecentlyViewed({ excludeId }: { excludeId: string }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let ids: string[] = [];
    try {
      ids = (JSON.parse(localStorage.getItem('recently-viewed') || '[]') as string[]).filter((id) => id !== excludeId).slice(0, 4);
    } catch {}
    if (!ids.length) return;
    let live = true;
    recentlyViewedAction(ids).then((p) => live && setProducts(p));
    return () => {
      live = false;
    };
  }, [excludeId]);

  if (!products.length) return null;
  return (
    <section aria-labelledby="recent-heading" className="shell pt-20 md:pt-28">
      <h2 id="recent-heading" className="display display-md mb-8">
        Recently viewed
      </h2>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-4 md:gap-x-5">
        {products.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
