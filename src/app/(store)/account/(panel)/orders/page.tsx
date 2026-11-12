import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { listOrdersForUser, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/orders';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Your orders', robots: { index: false } };

export default async function OrdersPage() {
  const user = await requireUser('/account/orders');
  const [orders, settings] = await Promise.all([listOrdersForUser(user.id), getSettings()]);
  return (
    <>
      <h1 className="display display-lg">Orders</h1>
      {orders.length === 0 ? (
        <div className="mt-6">
          <p className="lede">Orders you place while signed in will be listed here.</p>
          <Link href="/shop" className="btn btn-primary mt-6">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.number}`} className="grid grid-cols-2 gap-x-4 gap-y-1 py-4 hover:bg-sand sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center sm:px-3">
                <span>
                  <span className="block font-semibold">{o.number}</span>
                  <span className="small text-mute">
                    {o.createdAt.toLocaleDateString(settings.locale.locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </span>
                <span className="text-right sm:text-left">
                  <span className="tag border border-line-strong">{ORDER_STATUS_LABEL[o.status]}</span>
                </span>
                <span className="small text-mute">
                  {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}, {PAYMENT_STATUS_LABEL[o.paymentStatus].toLowerCase()}
                </span>
                <span className="text-right font-medium tabular-nums">{formatMoney(o.totalCents, o.currency, settings.locale.locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
