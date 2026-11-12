'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { addToCartAction } from '@/app/actions/cart';
import type { ProductCard as Product } from '@/lib/catalog';
import { discountPercent } from '@/lib/money';
import { Icon } from '../Icon';
import { useCartAction } from './CartLines';
import { useStore } from './StoreProvider';

export function ProductCard({
  product,
  sizes = '(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw',
  priority = false,
}: {
  product: Product;
  sizes?: string;
  priority?: boolean;
}) {
  const { money, wishlist, toggleWishlist, openCart, notify } = useStore();
  const { pending, run } = useCartAction();
  const colors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of product.variants) if (!seen.has(v.color)) seen.set(v.color, v.hex);
    return [...seen].map(([name, hex]) => ({ name, hex }));
  }, [product.variants]);
  const [color, setColor] = useState(colors[0]?.name ?? '');
  const [picking, setPicking] = useState(false);

  const primary = product.images.find((i) => i.color === color) ?? product.images[0];
  const secondary = product.images.find((i) => i.url !== primary?.url);
  const options = product.variants.filter((v) => v.color === color);
  const saved = wishlist.has(product.id);
  const off = discountPercent(product.priceCents, product.compareAtCents);
  const href = `/products/${product.slug}${color && color !== colors[0]?.name ? `?color=${encodeURIComponent(color)}` : ''}`;

  const add = (variantId: string) =>
    run(
      () => addToCartAction(variantId, 1),
      () => {
        setPicking(false);
        notify(`${product.name} added to your bag`);
        openCart();
      },
    );

  const quickAdd = () => {
    if (options.length === 1) {
      if (options[0].qty > 0) add(options[0].id);
      return;
    }
    setPicking((p) => !p);
  };

  return (
    <article className="group relative flex flex-col" onMouseLeave={() => setPicking(false)}>
      <div className="relative aspect-[3/4] overflow-hidden bg-sand">
        <Link href={href} aria-label={product.name} className="absolute inset-0" tabIndex={-1}>
          {primary && (
            <Image src={primary.url} alt={primary.alt || product.name} fill sizes={sizes} priority={priority} className="object-cover" />
          )}
          {secondary && (
            <Image
              src={secondary.url}
              alt=""
              fill
              sizes={sizes}
              className="object-cover opacity-0 transition-opacity duration-500 ease-out-soft group-hover:opacity-100 max-md:hidden"
            />
          )}
        </Link>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {!product.inStock ? (
            <span className="tag">Sold out</span>
          ) : (
            <>
              {product.badge && product.badge !== 'Sale' && <span className="tag">{product.badge}</span>}
              {off && <span className="tag bg-ink text-bone">{off}% off</span>}
            </>
          )}
        </div>

        <button
          type="button"
          className="absolute right-1.5 top-1.5 grid h-10 w-10 place-items-center rounded-full bg-paper/85 backdrop-blur transition hover:bg-paper"
          aria-pressed={saved}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          onClick={() => toggleWishlist(product.id, product.name)}
        >
          <Icon name="heart" size={18} filled={saved} className={saved ? 'text-brass-deep' : ''} />
        </button>

        {product.inStock && (
          <div
            className={`absolute inset-x-0 bottom-0 p-2.5 transition duration-300 ease-out-soft md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 ${
              picking ? '!translate-y-0 !opacity-100' : ''
            }`}
          >
            {picking ? (
              <div className="bg-paper p-3 shadow-lg" role="group" aria-label={`Choose a size for ${product.name} in ${color}`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="small font-semibold">Select a size</p>
                  <button type="button" className="small underline underline-offset-4" onClick={() => setPicking(false)}>
                    Cancel
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={v.qty < 1 || pending}
                      onClick={() => add(v.id)}
                      aria-label={`${v.size}${v.qty < 1 ? ', sold out' : ''}`}
                      className="min-w-10 rounded-[2px] border border-line-strong px-2 py-1.5 text-sm font-medium hover:border-ink hover:bg-ink hover:text-bone disabled:border-line disabled:text-mute/50 disabled:line-through disabled:hover:bg-transparent disabled:hover:text-mute/50"
                    >
                      {v.size}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-sm w-full bg-paper/95 text-ink shadow-sm backdrop-blur hover:bg-ink hover:text-bone max-md:ml-auto max-md:h-10 max-md:min-h-0 max-md:w-10 max-md:rounded-full max-md:p-0"
                onClick={quickAdd}
                disabled={pending}
                aria-label={`Quick add ${product.name}`}
              >
                <span className="max-md:hidden">{pending ? 'Adding…' : 'Quick add'}</span>
                <Icon name="plus" size={16} className="md:hidden" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-3 pt-3">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-medium leading-snug">
            <Link href={href} className="hover:text-brass-deep">
              {product.name}
            </Link>
          </h3>
          {colors.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5" role="group" aria-label="Colours">
              {colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  aria-label={`Show ${product.name} in ${c.name}`}
                  aria-pressed={c.name === color}
                  onClick={() => {
                    setColor(c.name);
                    setPicking(false);
                  }}
                  className={`h-[1.125rem] w-[1.125rem] rounded-full border border-black/15 outline-offset-2 ${
                    c.name === color ? 'outline outline-1 outline-ink' : ''
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <span className="small ml-1 text-mute">{colors.length === 1 ? colors[0].name : `${colors.length} colours`}</span>
            </div>
          )}
        </div>
        <p className="shrink-0 text-[0.9375rem] tabular-nums">
          {product.compareAtCents && (
            <s className="mr-1.5 text-mute">
              <span className="sr-only">Was </span>
              {money(product.compareAtCents)}
            </s>
          )}
          <span className={product.compareAtCents ? 'font-semibold text-brass-deep' : ''}>{money(product.priceCents)}</span>
        </p>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Product[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 md:gap-x-5 md:gap-y-12 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
