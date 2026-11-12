'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addToCartAction } from '@/app/actions/cart';
import type { ProductDetail } from '@/lib/catalog';
import { discountPercent } from '@/lib/money';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { useCartAction } from './CartLines';
import { SizeGuideTables } from './SizeGuide';
import { Stars } from './Stars';
import { useStore } from './StoreProvider';

const RECENT_KEY = 'recently-viewed';

export function ProductView({
  product,
  initialColor,
  shipping,
}: {
  product: ProductDetail;
  initialColor?: string;
  shipping: { name: string; days: string; price: string; freeOver: string | null }[];
}) {
  const { money, wishlist, toggleWishlist, openCart, notify } = useStore();
  const { pending, run } = useCartAction();
  const router = useRouter();

  const colors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of product.variants) if (!seen.has(v.color)) seen.set(v.color, v.hex);
    return [...seen].map(([name, hex]) => ({ name, hex }));
  }, [product.variants]);

  const [color, setColor] = useState(colors.find((c) => c.name === initialColor)?.name ?? colors[0]?.name ?? '');
  const sizes = product.variants.filter((v) => v.color === color);
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0].size : null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const sizeGroup = useRef<HTMLDivElement>(null);

  // Images for the chosen colour come first; shared (untagged) images follow.
  const images = useMemo(() => {
    const own = product.images.filter((i) => i.color === color);
    const shared = product.images.filter((i) => !i.color);
    const rest = product.images.filter((i) => i.color && i.color !== color);
    return own.length ? [...own, ...shared, ...rest] : product.images;
  }, [product.images, color]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [color]);
  const current = images[Math.min(index, images.length - 1)];

  const variant = sizes.find((v) => v.size === size) ?? null;
  const maxQty = variant ? Math.min(10, variant.qty) : 10;
  useEffect(() => {
    if (qty > maxQty) setQty(Math.max(1, maxQty));
  }, [maxQty, qty]);

  // Remember this product for the "recently viewed" rail.
  useEffect(() => {
    try {
      const prev: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      localStorage.setItem(RECENT_KEY, JSON.stringify([product.id, ...prev.filter((id) => id !== product.id)].slice(0, 9)));
    } catch {}
  }, [product.id]);

  const pickColor = (name: string) => {
    setColor(name);
    setError(null);
    setAdded(false);
    const next = product.variants.filter((v) => v.color === name);
    // Keep the size when it exists and is in stock in the new colour.
    setSize((s) => (next.length === 1 ? next[0].size : next.some((v) => v.size === s && v.qty > 0) ? s : null));
  };

  const submit = (then: 'bag' | 'checkout') => {
    if (!variant) {
      setError(sizes.length > 1 ? 'Select a size to continue.' : 'Select an option to continue.');
      sizeGroup.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
      return;
    }
    if (variant.qty < 1) {
      setError('That size is sold out.');
      return;
    }
    setError(null);
    run(
      () => addToCartAction(variant.id, qty),
      () => {
        if (then === 'checkout') router.push('/checkout');
        else {
          setAdded(true);
          notify(`${product.name} added to your bag`);
          openCart();
          setTimeout(() => setAdded(false), 2500);
        }
      },
    );
  };

  const saved = wishlist.has(product.id);
  const off = discountPercent(product.priceCents, product.compareAtCents);
  const stockNote = !variant
    ? null
    : variant.qty < 1
      ? { text: 'Sold out in this size', tone: 'text-danger' }
      : variant.qty <= 3
        ? { text: `Only ${variant.qty} left`, tone: 'text-brass-deep' }
        : { text: 'In stock, ready to ship', tone: 'text-ok' };

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      {/* Gallery */}
      <div className="lg:col-span-7">
        <div className="flex flex-col-reverse gap-3 md:flex-row">
          {images.length > 1 && (
            <ul className="no-scrollbar flex gap-2 overflow-x-auto md:w-20 md:shrink-0 md:flex-col md:overflow-visible" aria-label="Product images">
              {images.map((img, i) => (
                <li key={img.url} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show image ${i + 1} of ${images.length}`}
                    aria-current={i === index}
                    className={`relative block aspect-[3/4] w-16 overflow-hidden bg-sand md:w-20 ${
                      i === index ? 'outline outline-1 outline-offset-2 outline-ink' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ZoomImage key={current?.url} src={current?.url} alt={current?.alt || product.name} onOpen={() => setLightbox(true)} badge={off ? `${off}% off` : product.badge} />
        </div>
        {product.videoUrl && (
          <video className="mt-3 w-full bg-sand" controls preload="none" playsInline poster={images[0]?.url}>
            <source src={product.videoUrl} />
          </video>
        )}
      </div>

      {/* Buy box */}
      <div className="lg:col-span-5 lg:pl-4">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <p className="small text-mute">{product.brand}</p>
          <h1 className="display display-md mt-1">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-xl tabular-nums">
              {product.compareAtCents && (
                <s className="mr-2 text-mute">
                  <span className="sr-only">Was </span>
                  {money(product.compareAtCents)}
                </s>
              )}
              <span className={product.compareAtCents ? 'font-semibold text-brass-deep' : ''}>{money(product.priceCents)}</span>
            </p>
            {product.rating.count > 0 && (
              <a href="#reviews" className="small flex items-center gap-2 hover:text-brass-deep">
                <Stars rating={product.rating.average} size={14} />
                <span className="underline underline-offset-4">
                  {product.rating.count} {product.rating.count === 1 ? 'review' : 'reviews'}
                </span>
              </a>
            )}
          </div>

          <p className="mt-5 max-w-prose text-mute">{product.description}</p>

          {colors.length > 0 && (
            <fieldset className="mt-7">
              <legend className="label">
                Colour: <span className="font-normal text-mute">{color}</span>
              </legend>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => pickColor(c.name)}
                    aria-pressed={c.name === color}
                    aria-label={c.name}
                    title={c.name}
                    className={`h-9 w-9 rounded-full border border-black/15 outline-offset-[3px] ${c.name === color ? 'outline outline-1 outline-ink' : 'hover:outline hover:outline-1 hover:outline-line-strong'}`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {sizes.length > 1 && (
            <fieldset className="mt-6">
              <div className="flex items-baseline justify-between">
                <legend className="label float-left">
                  Size{size && <span className="font-normal text-mute">: {size}</span>}
                </legend>
                <button type="button" className="small flex items-center gap-1.5 underline underline-offset-4" onClick={() => setGuideOpen(true)}>
                  <Icon name="ruler" size={15} /> Size guide
                </button>
              </div>
              <div ref={sizeGroup} className="mt-2.5 flex flex-wrap gap-2" aria-describedby={error ? 'variant-error' : undefined}>
                {sizes.map((v) => {
                  const out = v.qty < 1;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={out}
                      aria-pressed={v.size === size}
                      aria-label={`${v.size}${out ? ', sold out' : ''}`}
                      onClick={() => {
                        setSize(v.size);
                        setError(null);
                      }}
                      className={`relative grid min-h-11 min-w-[3.25rem] place-items-center rounded-[2px] border px-3 text-sm font-medium transition-colors ${
                        v.size === size
                          ? 'border-ink bg-ink text-bone'
                          : out
                            ? 'border-line text-mute/60 line-through'
                            : `hover:border-ink ${error ? 'border-danger' : 'border-line-strong'}`
                      }`}
                    >
                      {v.size}
                    </button>
                  );
                })}
              </div>
              <p className="small mt-2 text-mute">{product.fit}</p>
            </fieldset>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div>
              <span className="label mb-2 block" id="qty-label">
                Quantity
              </span>
              <div className="inline-flex items-center rounded-[2px] border border-line-strong" role="group" aria-labelledby="qty-label">
                <button type="button" className="grid h-11 w-11 place-items-center hover:bg-sand disabled:opacity-30" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>
                  <Icon name="minus" size={14} />
                </button>
                <span className="w-9 text-center tabular-nums" aria-live="polite">
                  {qty}
                </span>
                <button type="button" className="grid h-11 w-11 place-items-center hover:bg-sand disabled:opacity-30" aria-label="Increase quantity" disabled={qty >= maxQty} onClick={() => setQty((q) => q + 1)}>
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </div>
            {stockNote && (
              <p className={`small mt-7 font-medium ${stockNote.tone}`} role="status">
                {stockNote.text}
              </p>
            )}
          </div>

          {error && (
            <p id="variant-error" role="alert" className="notice notice-error mt-5">
              {error}
            </p>
          )}

          <div className="mt-6 grid gap-2.5">
            <div className="flex gap-2.5">
              <button type="button" className="btn btn-primary flex-1" disabled={pending || !product.inStock} onClick={() => submit('bag')}>
                {!product.inStock ? 'Sold out' : pending ? 'Adding…' : added ? (
                  <>
                    <Icon name="check" size={18} /> Added to bag
                  </>
                ) : (
                  'Add to bag'
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary w-12 shrink-0 px-0"
                aria-pressed={saved}
                aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                onClick={() => toggleWishlist(product.id, product.name)}
              >
                <Icon name="heart" filled={saved} />
              </button>
            </div>
            {product.inStock && (
              <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => submit('checkout')}>
                Buy now
              </button>
            )}
          </div>

          <ul className="mt-6 grid gap-2.5 text-[0.9375rem]">
            {shipping[0] && (
              <li className="flex gap-3">
                <Icon name="truck" className="mt-0.5 shrink-0 text-mute" />
                <span>
                  {shipping[0].name} delivery in {shipping[0].days} working days, {shipping[0].price}
                  {shipping[0].freeOver ? `. Free on orders over ${shipping[0].freeOver}.` : '.'}
                </span>
              </li>
            )}
            <li className="flex gap-3">
              <Icon name="returns" className="mt-0.5 shrink-0 text-mute" />
              <span>
                Free returns within 30 days.{' '}
                <Link href="/help/returns" className="link">
                  Returns policy
                </Link>
              </span>
            </li>
          </ul>

          <div className="mt-7 border-t border-line">
            <Disclosure title="Material and care" open>
              <p>{product.materialDetails}</p>
              <p className="mt-2">{product.care}</p>
            </Disclosure>
            <Disclosure title="Fit">
              <p>{product.fit}</p>
              <button type="button" className="link mt-2" onClick={() => setGuideOpen(true)}>
                Open the size guide
              </button>
            </Disclosure>
            <Disclosure title="Delivery and returns">
              <ul className="grid gap-1.5">
                {shipping.map((s) => (
                  <li key={s.name}>
                    {s.name}: {s.days} working days, {s.price}
                    {s.freeOver ? ` (free over ${s.freeOver})` : ''}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Unworn pieces can be returned within 30 days for a full refund. Read the{' '}
                <Link href="/help/shipping" className="link">
                  shipping
                </Link>{' '}
                and{' '}
                <Link href="/help/returns" className="link">
                  returns
                </Link>{' '}
                pages for details.
              </p>
            </Disclosure>
          </div>
        </div>
      </div>

      <Sheet open={guideOpen} onClose={() => setGuideOpen(false)} title="Size guide" wide>
        <div className="px-5 py-5">
          <SizeGuideTables />
        </div>
      </Sheet>

      {lightbox && current && <Lightbox images={images} start={index} onClose={() => setLightbox(false)} name={product.name} />}
    </div>
  );
}

function Disclosure({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group border-b border-line">
      <summary className="flex list-none items-center justify-between py-4 font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <Icon name="plus" size={18} className="transition-transform duration-300 group-open:rotate-45" />
      </summary>
      <div className="pb-5 text-[0.9375rem] text-mute">{children}</div>
    </details>
  );
}

/** Main gallery image. Hover magnifies around the cursor on pointer devices; click opens the full-screen viewer. */
function ZoomImage({ src, alt, onOpen, badge }: { src?: string; alt: string; onOpen: () => void; badge?: string | null }) {
  const [origin, setOrigin] = useState<string | null>(null);
  if (!src) return <div className="aspect-[3/4] flex-1 bg-sand" />;
  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open full-screen image viewer"
        className="relative block aspect-[3/4] w-full cursor-zoom-in overflow-hidden bg-sand"
        onMouseMove={(e) => {
          if (e.nativeEvent instanceof MouseEvent && window.matchMedia('(hover: hover)').matches) {
            const r = e.currentTarget.getBoundingClientRect();
            setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
          }
        }}
        onMouseLeave={() => setOrigin(null)}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 ease-out-soft"
          style={origin ? { transform: 'scale(2)', transformOrigin: origin } : undefined}
        />
      </button>
      {badge && <span className="tag pointer-events-none absolute left-3 top-3">{badge}</span>}
      <span className="pointer-events-none absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-paper/85">
        <Icon name="zoom" size={18} />
      </span>
    </div>
  );
}

function Lightbox({ images, start, onClose, name }: { images: { url: string; alt: string }[]; start: number; onClose: () => void; name: string }) {
  const [i, setI] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % images.length);
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [images.length, onClose]);

  useEffect(() => setZoomed(false), [i]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${name} images`} className="fixed inset-0 z-[75] flex flex-col bg-bone">
      <div className="flex items-center justify-between px-4 py-2">
        <p className="small text-mute" aria-live="polite">
          Image {i + 1} of {images.length}. {zoomed ? 'Click to zoom out.' : 'Click to zoom in.'}
        </p>
        <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close image viewer">
          <Icon name="close" />
        </button>
      </div>
      <div className={`relative min-h-0 flex-1 ${zoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
          className={`relative block ${zoomed ? 'h-[200%] w-[200%] cursor-zoom-out max-md:h-[220%] max-md:w-[300%]' : 'h-full w-full cursor-zoom-in'}`}
        >
          <Image src={images[i].url} alt={images[i].alt || name} fill sizes={zoomed ? '200vw' : '100vw'} className="object-contain" quality={90} />
        </button>
      </div>
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-3 py-3">
          <button type="button" className="icon-btn border border-line-strong" aria-label="Previous image" onClick={() => setI((x) => (x - 1 + images.length) % images.length)}>
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="icon-btn border border-line-strong" aria-label="Next image" onClick={() => setI((x) => (x + 1) % images.length)}>
            <Icon name="chevronRight" />
          </button>
        </div>
      )}
    </div>
  );
}
