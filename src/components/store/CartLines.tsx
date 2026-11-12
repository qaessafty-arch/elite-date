'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  applyCouponAction,
  changeVariantAction,
  removeCouponAction,
  setQuantityAction,
  type CartResult,
} from '@/app/actions/cart';
import type { CartLine } from '@/lib/cart';
import { Icon } from '../Icon';
import { useStore } from './StoreProvider';

/** Runs a cart action, syncs the provider and surfaces errors. Shared by the drawer and the bag page. */
export function useCartAction() {
  const { setCart, notify } = useStore();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<CartResult>, onOk?: () => void) =>
    start(async () => {
      const res = await action();
      if (res.cart) setCart(res.cart);
      if (!res.ok) notify(res.error, 'error');
      else onOk?.();
    });
  return { pending, run };
}

export function CartLineRow({ line, onNavigate }: { line: CartLine; onNavigate?: () => void }) {
  const { money } = useStore();
  const { pending, run } = useCartAction();
  const max = Math.min(10, line.available);
  const short = line.available < line.quantity;

  return (
    <li className={`flex gap-4 py-5 ${pending ? 'opacity-60' : ''}`} aria-busy={pending}>
      <Link href={`/products/${line.slug}`} onClick={onNavigate} className="relative block h-32 w-24 shrink-0 overflow-hidden bg-sand">
        {line.image && <Image src={line.image} alt={line.name} fill sizes="96px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/products/${line.slug}`} onClick={onNavigate} className="font-medium hover:text-brass-deep">
            {line.name}
          </Link>
          <p className="shrink-0 font-medium tabular-nums">{money(line.lineTotalCents)}</p>
        </div>

        <label className="mt-1.5 block">
          <span className="sr-only">Colour and size for {line.name}</span>
          <select
            className="small max-w-full cursor-pointer rounded-[2px] border border-line bg-transparent py-1 pl-2 pr-6 text-mute hover:border-mute"
            value={line.variantId}
            disabled={pending}
            onChange={(e) => run(() => changeVariantAction(line.id, e.target.value))}
          >
            {line.options.map((o) => (
              <option key={o.id} value={o.id} disabled={o.qty < 1 && o.id !== line.variantId}>
                {o.color}, {o.size}
                {o.qty < 1 && o.id !== line.variantId ? ' (sold out)' : ''}
              </option>
            ))}
          </select>
        </label>

        {short && (
          <p className="small mt-1.5 text-danger">
            {line.available < 1 ? 'Now sold out. Remove it to check out.' : `Only ${line.available} left. Lower the quantity to check out.`}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="inline-flex items-center rounded-[2px] border border-line-strong">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center hover:bg-sand"
              aria-label={`Decrease quantity of ${line.name}`}
              disabled={pending}
              onClick={() => run(() => setQuantityAction(line.id, line.quantity - 1))}
            >
              <Icon name="minus" size={14} />
            </button>
            <span className="w-8 text-center text-sm tabular-nums" aria-live="polite" aria-label={`Quantity ${line.quantity}`}>
              {line.quantity}
            </span>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center hover:bg-sand disabled:opacity-30"
              aria-label={`Increase quantity of ${line.name}`}
              disabled={pending || line.quantity >= max}
              onClick={() => run(() => setQuantityAction(line.id, line.quantity + 1))}
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
          <button
            type="button"
            className="small text-mute underline underline-offset-4 hover:text-ink"
            disabled={pending}
            onClick={() => run(() => setQuantityAction(line.id, 0))}
          >
            Remove<span className="sr-only"> {line.name}</span>
          </button>
        </div>
      </div>
    </li>
  );
}

export function CouponForm() {
  const { cart } = useStore();
  const { pending, run } = useCartAction();
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <p>
          <span className="tag mr-2 border border-line-strong">{cart.coupon.code}</span>
          <span className="text-mute">{cart.coupon.description}</span>
        </p>
        <button type="button" className="shrink-0 underline underline-offset-4" disabled={pending} onClick={() => run(removeCouponAction)}>
          Remove code
        </button>
      </div>
    );
  }
  return (
    <div>
      {cart.couponNotice && <p className="small mb-2 text-danger">{cart.couponNotice}</p>}
      {!open ? (
        <button type="button" className="small underline underline-offset-4" onClick={() => setOpen(true)}>
          Add a promo code
        </button>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) run(() => applyCouponAction(code), () => setCode(''));
          }}
        >
          <label className="sr-only" htmlFor="promo-code">
            Promo code
          </label>
          <input
            id="promo-code"
            className="input min-h-10 flex-1 py-1.5 uppercase placeholder:normal-case"
            placeholder="Promo code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={40}
            autoComplete="off"
            autoFocus
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={pending || !code.trim()}>
            {pending ? 'Applying…' : 'Apply code'}
          </button>
        </form>
      )}
    </div>
  );
}

export function TotalsList({ showShippingNote = true }: { showShippingNote?: boolean }) {
  const { cart, money } = useStore();
  const t = cart.totals;
  return (
    <dl className="grid gap-1.5 text-[0.9375rem]">
      <div className="flex justify-between">
        <dt className="text-mute">Subtotal</dt>
        <dd className="tabular-nums">{money(t.subtotalCents)}</dd>
      </div>
      {t.discountCents > 0 && (
        <div className="flex justify-between">
          <dt className="text-mute">Discount</dt>
          <dd className="tabular-nums text-ok">−{money(t.discountCents)}</dd>
        </div>
      )}
      {showShippingNote && (
        <div className="flex justify-between">
          <dt className="text-mute">Shipping</dt>
          <dd className="text-mute">Calculated at checkout</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-mute">Estimated tax</dt>
        <dd className="tabular-nums">{money(t.taxCents)}</dd>
      </div>
      <div className="mt-2 flex justify-between border-t border-line pt-3 text-base font-semibold">
        <dt>Total before shipping</dt>
        <dd className="tabular-nums">{money(t.totalCents)}</dd>
      </div>
    </dl>
  );
}

export function FreeShippingMeter() {
  const { cart, money } = useStore();
  const goal = cart.freeShippingAtCents;
  if (!goal || !cart.lines.length) return null;
  const current = cart.totals.subtotalCents - cart.totals.discountCents;
  const left = Math.max(goal - current, 0);
  return (
    <div className="bg-sand px-5 py-3">
      <p className="small font-medium">
        {left > 0 ? `Add ${money(left)} more for free standard shipping` : 'Your order ships free with standard delivery'}
      </p>
      <div
        className="mt-2 h-0.5 bg-line-strong"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(current, goal)}
        aria-label="Progress towards free shipping"
      >
        <div className="h-full bg-brass transition-[width] duration-500 ease-out-soft" style={{ width: `${Math.min((current / goal) * 100, 100)}%` }} />
      </div>
    </div>
  );
}
