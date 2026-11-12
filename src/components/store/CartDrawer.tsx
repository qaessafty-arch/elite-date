'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Sheet } from '../Sheet';
import { CartLineRow, CouponForm, FreeShippingMeter, TotalsList } from './CartLines';
import { useStore } from './StoreProvider';

export function CartDrawer() {
  const { cart, cartOpen, closeCart } = useStore();
  const pathname = usePathname();
  useEffect(() => closeCart(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocked = cart.lines.some((l) => l.available < l.quantity);

  return (
    <Sheet
      open={cartOpen}
      onClose={closeCart}
      title={cart.itemCount ? `Your bag (${cart.itemCount})` : 'Your bag'}
      footer={
        cart.lines.length > 0 && (
          <div className="grid gap-4 px-5 py-4">
            <CouponForm />
            <TotalsList />
            {blocked ? (
              <button type="button" className="btn btn-primary btn-block" disabled>
                Fix the items above to check out
              </button>
            ) : (
              <Link href="/checkout" className="btn btn-primary btn-block">
                Check out
              </Link>
            )}
            <Link href="/cart" className="small text-center underline underline-offset-4">
              View full bag
            </Link>
          </div>
        )
      }
    >
      {cart.lines.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="display display-sm">Your bag is empty.</p>
          <p className="mt-2 text-mute">Pieces you add will wait here until you are ready.</p>
          <div className="mt-6 grid gap-3">
            <Link href="/c/new-arrivals" className="btn btn-primary">
              Shop new arrivals
            </Link>
            <Link href="/c/best-sellers" className="btn btn-secondary">
              See best sellers
            </Link>
          </div>
        </div>
      ) : (
        <>
          <FreeShippingMeter />
          <ul className="divide-y divide-line px-5">
            {cart.lines.map((line) => (
              <CartLineRow key={line.id} line={line} onNavigate={closeCart} />
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
