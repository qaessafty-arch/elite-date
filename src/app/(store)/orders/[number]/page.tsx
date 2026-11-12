import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ResumePayment } from '@/components/store/ResumePayment';
import { getCurrentUser } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { canViewOrder, getOrderByNumber, getOrderItems, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus } from '@/lib/orders';
import { COUNTRY_NAMES, getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Your order', robots: { index: false } };

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ key?: string; placed?: string; payment?: string }> };

const TIMELINE: OrderStatus[] = ['confirmed', 'processing', 'shipped', 'delivered'];

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ number }, sp, user, settings] = await Promise.all([params, searchParams, getCurrentUser(), getSettings()]);
  const order = await getOrderByNumber(number);
  // Unknown orders and orders the visitor may not see look identical.
  if (!order || !(await canViewOrder(order, user, sp.key))) notFound();
  const items = await getOrderItems(order.id);
  const money = (c: number) => formatMoney(c, order.currency, settings.locale.locale);
  const reached = TIMELINE.indexOf(order.status);
  const awaitingPayment = order.status === 'pending' && order.paymentStatus === 'unpaid';

  return (
    <div className="shell max-w-5xl pb-10 pt-8 md:pt-12">
      {sp.placed === '1' && !awaitingPayment && (
        <p className="notice notice-ok mb-8" role="status">
          Thank you, {order.firstName}. Your order is confirmed and a receipt is on its way to {order.email}.
        </p>
      )}
      {awaitingPayment && (
        <div className="notice mb-8" role="status">
          <p className="font-semibold">
            {sp.payment === 'cancelled' ? 'Payment was not completed.' : 'We are waiting for your payment to be confirmed.'}
          </p>
          <p className="mt-1 text-mute">
            Your items are reserved for a short while. If you have just paid, this page will update once the payment provider confirms it.
          </p>
          {sp.key && <ResumePayment number={order.number} accessKey={sp.key} />}
        </div>
      )}

      <p className="small text-mute">
        Placed {order.createdAt.toLocaleDateString(settings.locale.locale, { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      <h1 className="display display-lg mt-1">Order {order.number}</h1>
      <p className="mt-3 flex flex-wrap gap-2">
        <span className="tag border border-line-strong">{ORDER_STATUS_LABEL[order.status]}</span>
        <span className="tag border border-line-strong">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</span>
      </p>

      {order.status !== 'cancelled' && (
        <ol className="mt-8 grid grid-cols-4 gap-1" aria-label="Order progress">
          {TIMELINE.map((s, i) => (
            <li key={s} className={`border-t-2 pt-2 text-sm ${i <= reached ? 'border-ink font-semibold' : 'border-line text-mute'}`} aria-current={i === reached ? 'step' : undefined}>
              {ORDER_STATUS_LABEL[s]}
              {i <= reached && <span className="sr-only"> (done)</span>}
            </li>
          ))}
        </ol>
      )}
      {order.trackingNumber && (
        <p className="mt-5">
          Tracking: <strong className="font-semibold">{order.trackingCarrier}</strong> {order.trackingNumber}
        </p>
      )}

      <div className="mt-10 grid gap-10 md:grid-cols-12">
        <section className="md:col-span-7" aria-labelledby="items-heading">
          <h2 id="items-heading" className="display display-sm">
            Items
          </h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {items.map((it) => (
              <li key={it.id} className="flex gap-4 py-4">
                <span className="relative block h-24 w-20 shrink-0 overflow-hidden bg-sand">
                  {it.imageUrl && <Image src={it.imageUrl} alt="" fill sizes="80px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/products/${it.productSlug}`} className="font-medium hover:text-brass-deep">
                    {it.productName}
                  </Link>
                  <span className="small block text-mute">
                    {it.color}, {it.size}. Quantity {it.quantity}
                  </span>
                  <span className="small block text-mute">SKU {it.sku}</span>
                </span>
                <span className="tabular-nums">{money(it.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid content-start gap-8 md:col-span-5">
          <section aria-labelledby="totals-heading" className="border border-line bg-paper p-5">
            <h2 id="totals-heading" className="display display-sm">
              Payment summary
            </h2>
            <dl className="mt-3 grid gap-1.5 text-[0.9375rem]">
              <div className="flex justify-between">
                <dt className="text-mute">Subtotal</dt>
                <dd className="tabular-nums">{money(order.subtotalCents)}</dd>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-mute">Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
                  <dd className="tabular-nums text-ok">−{money(order.discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-mute">Shipping, {order.shippingMethodName.toLowerCase()}</dt>
                <dd className="tabular-nums">{order.shippingCents ? money(order.shippingCents) : 'Free'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">Tax</dt>
                <dd className="tabular-nums">{money(order.taxCents)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-3 text-lg font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(order.totalCents)}</dd>
              </div>
            </dl>
          </section>
          <section aria-labelledby="ship-heading">
            <h2 id="ship-heading" className="display display-sm">
              Delivery address
            </h2>
            <address className="mt-2 not-italic text-mute">
              {order.firstName} {order.lastName}
              <br />
              {order.shipLine1}
              {order.shipLine2 && (
                <>
                  <br />
                  {order.shipLine2}
                </>
              )}
              <br />
              {order.shipCity}
              {order.shipRegion ? `, ${order.shipRegion}` : ''} {order.shipPostalCode}
              <br />
              {COUNTRY_NAMES[order.shipCountry] ?? order.shipCountry}
            </address>
          </section>
          <p className="small text-mute">
            Need to change something?{' '}
            <Link href="/help/contact" className="link">
              Contact customer care
            </Link>{' '}
            and quote {order.number}.
          </p>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/shop" className="btn btn-primary">
          Continue shopping
        </Link>
        {user ? (
          <Link href="/account/orders" className="btn btn-secondary">
            See all your orders
          </Link>
        ) : (
          <Link href="/account/register" className="btn btn-secondary">
            Create an account to keep your orders together
          </Link>
        )}
      </div>
    </div>
  );
}
