'use client';

import Link from 'next/link';
import { CartLineRow, CouponForm, FreeShippingMeter, TotalsList } from './CartLines';
import { useStore } from './StoreProvider';

export function BagPage() {
  const { cart } = useStore();
  const blocked = cart.lines.some((l) => l.available < l.quantity);

  if (!cart.lines.length) {
    return (
      <div className="shell py-24 text-center">
        <h1 className="display display-lg">Your bag is empty</h1>
        <p className="lede mx-auto mt-3">Pieces you add will wait here until you are ready to check out.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/c/new-arrivals" className="btn btn-primary">
            Shop new arrivals
          </Link>
          <Link href="/c/best-sellers" className="btn btn-secondary">
            See best sellers
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="shell pb-10 pt-8 md:pt-12">
      <h1 className="display display-lg">Your bag</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <FreeShippingMeter />
          <ul className="divide-y divide-line border-b border-line">
            {cart.lines.map((line) => (
              <CartLineRow key={line.id} line={line} />
            ))}
          </ul>
          <Link href="/shop" className="link mt-6 inline-block">
            Continue shopping
          </Link>
        </div>
        <aside className="lg:col-span-5 lg:pl-6" aria-label="Order summary">
          <div className="grid gap-5 border border-line bg-paper p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
            <h2 className="display display-sm">Summary</h2>
            <CouponForm />
            <TotalsList />
            {blocked ? (
              <button type="button" className="btn btn-primary btn-block" disabled>
                Fix the items marked above to check out
              </button>
            ) : (
              <Link href="/checkout" className="btn btn-primary btn-block">
                Check out
              </Link>
            )}
            <p className="small text-center text-mute">Shipping is calculated at the next step. Free returns within 30 days.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
