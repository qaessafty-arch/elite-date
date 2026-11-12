import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cancelOrderAction, markPaidAction, refundOrderAction, setTrackingAction, updateOrderStatusAction } from '@/app/admin/actions';
import { PageHeader, Panel, Status, TableWrap, td, th } from '@/components/admin/parts';
import { RowForm } from '@/components/admin/ui';
import { auditFor, orderPayments } from '@/lib/admin';
import { can, requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { getOrderById, getOrderItems, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/orders';
import { demoPaymentsAllowed } from '@/lib/payments';
import { COUNTRY_NAMES, getSettings } from '@/lib/settings';

export const metadata = { title: 'Order' };

const NEXT_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'] as const;

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin('orders.manage');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const order = await getOrderById(id);
  if (!order) notFound();
  const [items, payments, trail, settings] = await Promise.all([getOrderItems(id), orderPayments(id), auditFor('order', id), getSettings()]);
  const money = (c: number) => formatMoney(c, order.currency, settings.locale.locale);
  const captured = payments.filter((p) => ['succeeded', 'partially_refunded'].includes(p.status));
  const refundable = captured.reduce((s, p) => s + p.amount_cents - p.refunded_cents, 0);
  const cancellable = !['cancelled', 'shipped', 'delivered'].includes(order.status);

  return (
    <>
      <PageHeader
        title={`Order ${order.number}`}
        description={`Placed ${order.createdAt.toLocaleString(settings.locale.locale, { dateStyle: 'long', timeStyle: 'short' })}`}
        actions={
          <>
            <Status value={order.status} label={ORDER_STATUS_LABEL[order.status]} />
            <Status value={order.paymentStatus} label={PAYMENT_STATUS_LABEL[order.paymentStatus]} />
            <Link href="/admin/orders" className="btn btn-secondary btn-sm">Back to orders</Link>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-6">
          <Panel title="Items">
            <TableWrap>
              <table className="w-full min-w-[30rem] border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className={th}>Product</th>
                    <th scope="col" className={th}>SKU</th>
                    <th scope="col" className={`${th} text-right`}>Qty</th>
                    <th scope="col" className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <th scope="row" className={`${td} font-semibold`}>
                        {i.productName}
                        <span className="small block font-normal text-mute">{i.color}, {i.size}, {money(i.unitPriceCents)} each</span>
                      </th>
                      <td className={`${td} small text-mute`}>{i.sku}</td>
                      <td className={`${td} text-right tabular-nums`}>{i.quantity}</td>
                      <td className={`${td} text-right tabular-nums`}>{money(i.lineTotalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <dl className="ml-auto mt-4 grid max-w-xs gap-1 text-[0.9375rem]">
              <div className="flex justify-between"><dt className="text-mute">Subtotal</dt><dd className="tabular-nums">{money(order.subtotalCents)}</dd></div>
              {order.discountCents > 0 && <div className="flex justify-between"><dt className="text-mute">Discount {order.couponCode}</dt><dd className="tabular-nums">−{money(order.discountCents)}</dd></div>}
              <div className="flex justify-between"><dt className="text-mute">Shipping, {order.shippingMethodName}</dt><dd className="tabular-nums">{money(order.shippingCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">Tax</dt><dd className="tabular-nums">{money(order.taxCents)}</dd></div>
              <div className="mt-1 flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(order.totalCents)}</dd></div>
            </dl>
          </Panel>

          <Panel title="Payments">
            {payments.length === 0 ? (
              <p className="text-mute">No payment has been recorded for this order.</p>
            ) : (
              <ul className="grid gap-2 text-[0.9375rem]">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
                    <span>
                      <span className="font-semibold capitalize">{p.provider}</span>
                      <span className="small block text-mute">{p.provider_ref ?? 'No reference'}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Status value={p.status} />
                      <span className="tabular-nums">
                        {money(p.amount_cents)}
                        {p.refunded_cents > 0 && <span className="small block text-mute">{money(p.refunded_cents)} refunded</span>}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {order.paymentStatus === 'unpaid' && order.status !== 'cancelled' && demoPaymentsAllowed() && (
              <div className="mt-4">
                <RowForm action={markPaidAction} hidden={{ id }} label="Record payment received" />
                <p className="small text-mute">For offline payments such as bank transfer. Not available in production.</p>
              </div>
            )}
            {refundable > 0 && can(user, 'refunds.process') && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="label mb-2">Refund</h3>
                <RowForm action={refundOrderAction} hidden={{ id }} label="Issue refund">
                  <label className="field">
                    <span>Amount, up to {money(refundable)}</span>
                    <input name="amount" defaultValue={(refundable / 100).toFixed(2)} className="input min-h-10 w-36 py-1.5 tabular-nums" inputMode="decimal" />
                  </label>
                </RowForm>
                <p className="small text-mute">Card payments are refunded through the payment provider. Refunding does not restock items.</p>
              </div>
            )}
          </Panel>

          <Panel title="Audit trail">
            {trail.length === 0 ? (
              <p className="text-mute">No activity recorded.</p>
            ) : (
              <ol className="grid gap-3 border-l border-line-strong pl-5 text-[0.9375rem]">
                {trail.map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[1.5625rem] top-1.5 h-2 w-2 rounded-full bg-brass" aria-hidden="true" />
                    <span className="font-medium">{t.action.replace('order.', '').replace(/_/g, ' ')}</span>
                    {Object.keys(t.details).length > 0 && <span className="text-mute"> ({Object.entries(t.details).map(([k, v]) => `${k}: ${String(v)}`).join(', ')})</span>}
                    <span className="small block text-mute">
                      {t.actor_email ?? 'Customer or system'}, {t.created_at.toLocaleString(settings.locale.locale, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Fulfilment">
            {order.status === 'cancelled' ? (
              <p className="text-mute">This order was cancelled. Its stock has been returned.</p>
            ) : (
              <>
                <RowForm action={updateOrderStatusAction} hidden={{ id }} label="Update status">
                  <label className="field">
                    <span>Status</span>
                    <select name="status" defaultValue={order.status === 'pending' ? 'confirmed' : order.status} className="input min-h-10 py-1.5">
                      {NEXT_STATUSES.map((s) => (
                        <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </label>
                </RowForm>
                <div className="mt-5 border-t border-line pt-4">
                  <RowForm action={setTrackingAction} hidden={{ id }} label="Save tracking" className="grid grid-cols-2 items-end gap-2">
                    <label className="field">
                      <span>Carrier</span>
                      <input name="carrier" defaultValue={order.trackingCarrier ?? ''} className="input min-h-10 py-1.5" maxLength={40} placeholder="UPS" />
                    </label>
                    <label className="field">
                      <span>Tracking number</span>
                      <input name="trackingNumber" defaultValue={order.trackingNumber ?? ''} className="input min-h-10 py-1.5" maxLength={60} />
                    </label>
                  </RowForm>
                </div>
              </>
            )}
          </Panel>

          <Panel title="Customer">
            <p className="font-semibold">{order.firstName} {order.lastName}</p>
            <p className="text-mute">{order.email}</p>
            {order.phone && <p className="text-mute">{order.phone}</p>}
            {order.userId ? (
              <Link href={`/admin/customers/${order.userId}`} className="link mt-2 inline-block">View customer</Link>
            ) : (
              <p className="small mt-2 text-mute">Guest checkout</p>
            )}
            <h3 className="label mb-1 mt-5">Ship to</h3>
            <address className="not-italic text-mute">
              {order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ''}<br />
              {order.shipCity}{order.shipRegion ? `, ${order.shipRegion}` : ''} {order.shipPostalCode}<br />
              {COUNTRY_NAMES[order.shipCountry] ?? order.shipCountry}
            </address>
          </Panel>

          {cancellable && (
            <Panel title="Cancel order">
              <p className="text-mute">Cancelling returns the items to stock. It does not refund a payment; do that above first if one was taken.</p>
              <RowForm action={cancelOrderAction} hidden={{ id }} label="Cancel this order" className="mt-3 grid gap-2">
                <label className="field">
                  <span>Reason (kept in the audit trail)</span>
                  <input name="reason" className="input min-h-10 py-1.5" maxLength={200} />
                </label>
              </RowForm>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
