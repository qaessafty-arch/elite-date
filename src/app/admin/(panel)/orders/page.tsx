import Link from 'next/link';
import { PageHeader, Pager, Panel, Status, TableWrap, td, th } from '@/components/admin/parts';
import { ADMIN_PER_PAGE, adminOrders } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus, type PaymentStatus } from '@/lib/orders';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Orders' };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; payment?: string; page?: string }> }) {
  await requireAdmin('orders.manage');
  const sp = await searchParams;
  const status = sp.status && sp.status in ORDER_STATUS_LABEL ? sp.status : undefined;
  const payment = sp.payment && sp.payment in PAYMENT_STATUS_LABEL ? sp.payment : undefined;
  const [{ rows, total, page }, settings] = await Promise.all([adminOrders({ q: sp.q, status, payment, page: Number(sp.page) || 1 }), getSettings()]);
  const qs = (p: number) => `/admin/orders?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(status ? { status } : {}), ...(payment ? { payment } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Orders" description="Search by order number, email or customer name." />
      <Panel>
        <form className="mb-5 flex flex-wrap items-end gap-3" role="search">
          <label className="field min-w-48 flex-1">
            <span>Search</span>
            <input name="q" defaultValue={sp.q} className="input min-h-10 py-1.5" placeholder="HD-…, email or name" />
          </label>
          <label className="field">
            <span>Order status</span>
            <select name="status" defaultValue={status ?? ''} className="input min-h-10 py-1.5">
              <option value="">All</option>
              {Object.entries(ORDER_STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Payment</span>
            <select name="payment" defaultValue={payment ?? ''} className="input min-h-10 py-1.5">
              <option value="">All</option>
              {Object.entries(PAYMENT_STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-secondary btn-sm">Apply</button>
        </form>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-mute">No orders match those filters.</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[46rem] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={th}>Order</th>
                  <th scope="col" className={th}>Customer</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Payment</th>
                  <th scope="col" className={`${th} text-right`}>Items</th>
                  <th scope="col" className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <th scope="row" className={`${td} font-semibold`}>
                      <Link href={`/admin/orders/${o.id}`} className="hover:text-brass-deep">{o.number}</Link>
                      <span className="small block font-normal text-mute">{o.created_at.toLocaleDateString(settings.locale.locale, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </th>
                    <td className={td}>
                      {o.first_name} {o.last_name}
                      <span className="small block max-w-[16rem] truncate text-mute">{o.email}</span>
                    </td>
                    <td className={td}><Status value={o.status} label={ORDER_STATUS_LABEL[o.status as OrderStatus]} /></td>
                    <td className={td}><Status value={o.payment_status} label={PAYMENT_STATUS_LABEL[o.payment_status as PaymentStatus]} /></td>
                    <td className={`${td} text-right tabular-nums`}>{o.items}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatMoney(o.total_cents, o.currency, settings.locale.locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pager page={page} total={total} perPage={ADMIN_PER_PAGE} href={qs} />
      </Panel>
    </>
  );
}
