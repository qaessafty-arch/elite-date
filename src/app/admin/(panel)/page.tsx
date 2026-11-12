import Link from 'next/link';
import { PageHeader, Panel, Status, TableWrap, td, th } from '@/components/admin/parts';
import { dashboardStats } from '@/lib/admin';
import { can, requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { PERMISSION_LABELS, type Permission } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Overview' };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireAdmin('dashboard.view');
  const [stats, settings, sp] = await Promise.all([dashboardStats(), getSettings(), searchParams]);
  const { currency, locale } = settings.locale;
  const money = (c: number) => formatMoney(c, currency, locale);
  const t = stats.totals;
  const max = Math.max(...stats.daily.map((d) => d.revenue), 1);
  const monthRevenue = stats.daily.reduce((s, d) => s + d.revenue, 0);
  const monthOrders = stats.daily.reduce((s, d) => s + d.orders, 0);
  const day = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });

  const figures = [
    { label: 'Revenue, all time', value: money(t.revenue), note: 'Net of refunds' },
    { label: 'Orders', value: String(t.orders), note: `${t.open_orders} open`, href: can(user, 'orders.manage') ? '/admin/orders' : undefined },
    { label: 'Published products', value: String(t.products), href: can(user, 'products.manage') ? '/admin/products' : undefined },
    { label: 'Low-stock variants', value: String(t.low_stock), note: 'At or below threshold', href: can(user, 'products.manage') ? '/admin/inventory?low=1' : undefined },
  ];

  return (
    <>
      {sp.denied && (
        <p className="notice notice-error mb-6" role="alert">
          Your role cannot do that: {PERMISSION_LABELS[sp.denied as Permission]?.toLowerCase() ?? 'open that page'}.
        </p>
      )}
      <PageHeader title="Overview" description={`${settings.brand.name}, as of ${new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}.`} />

      <dl className="grid grid-cols-2 border-l border-t border-line bg-paper xl:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className="border-b border-r border-line p-5">
            <dt className="small text-mute">{f.label}</dt>
            <dd className="display mt-2 text-[clamp(1.75rem,3vw,2.75rem)] leading-none tabular-nums">
              {f.href ? (
                <Link href={f.href} className="hover:text-brass-deep">
                  {f.value}
                </Link>
              ) : (
                f.value
              )}
            </dd>
            {f.note && <dd className="small mt-2 text-mute">{f.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Sales, last 30 days" className="xl:col-span-2">
          <p className="text-mute">
            <strong className="font-semibold text-ink">{money(monthRevenue)}</strong> from {monthOrders} {monthOrders === 1 ? 'order' : 'orders'}
          </p>
          {monthRevenue === 0 ? (
            <p className="mt-8 text-mute">No paid orders in the last 30 days yet.</p>
          ) : (
            <figure className="mt-5">
              <div className="flex h-44 items-end gap-[3px] border-b border-line-strong" aria-hidden="true">
                {stats.daily.map((d) => (
                  <div key={d.day.toISOString()} className="group relative flex h-full flex-1 items-end">
                    <div
                      className="w-full bg-brass transition-colors group-hover:bg-ink"
                      style={{ height: `${d.revenue ? Math.max((d.revenue / max) * 100, 2) : 0}%` }}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 text-xs text-bone group-hover:block">
                      {day(d.day)}: {money(d.revenue)}
                    </div>
                  </div>
                ))}
              </div>
              <figcaption className="small mt-2 flex justify-between text-mute">
                <span>{day(stats.daily[0].day)}</span>
                <span>Peak day {money(max)}</span>
                <span>{day(stats.daily[stats.daily.length - 1].day)}</span>
              </figcaption>
              <table className="sr-only">
                <caption>Daily revenue for the last 30 days</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Revenue</th>
                    <th scope="col">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.daily.map((d) => (
                    <tr key={d.day.toISOString()}>
                      <th scope="row">{day(d.day)}</th>
                      <td>{money(d.revenue)}</td>
                      <td>{d.orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>
          )}
        </Panel>

        <Panel title="Best sellers">
          {stats.bestSellers.length === 0 ? (
            <p className="text-mute">Nothing sold yet.</p>
          ) : (
            <ol className="grid gap-3">
              {stats.bestSellers.map((p, i) => (
                <li key={p.id} className="flex items-baseline gap-3">
                  <span className="display w-5 text-xl text-brass-deep">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-brass-deep">
                      {p.name}
                    </Link>
                    <span className="small block text-mute">
                      {p.units} sold, {money(p.revenue)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Recent transactions" className="xl:col-span-2">
          <TableWrap>
            <table className="w-full min-w-[34rem] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={th}>Order</th>
                  <th scope="col" className={th}>Customer</th>
                  <th scope="col" className={th}>Method</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPayments.map((p) => (
                  <tr key={`${p.order_id}-${p.created_at.toISOString()}`}>
                    <th scope="row" className={`${td} font-semibold`}>
                      <Link href={`/admin/orders/${p.order_id}`} className="hover:text-brass-deep">
                        {p.number}
                      </Link>
                      <span className="small block font-normal text-mute">{day(p.created_at)}</span>
                    </th>
                    <td className={`${td} max-w-[14rem] truncate`}>{p.email}</td>
                    <td className={`${td} capitalize`}>{p.provider}</td>
                    <td className={td}>
                      <Status value={p.status} />
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{money(p.amount_cents - p.refunded_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>

        <div className="grid content-start gap-6">
          <Panel title="Running low">
            {stats.lowStock.length === 0 ? (
              <p className="text-mute">Every variant is above its threshold.</p>
            ) : (
              <ul className="grid gap-2.5 text-[0.9375rem]">
                {stats.lowStock.map((v, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <Link href={`/admin/products/${v.product_id}`} className="min-w-0 truncate hover:text-brass-deep">
                      {v.name} <span className="text-mute">{v.color}, {v.size}</span>
                    </Link>
                    <span className={`shrink-0 tabular-nums font-semibold ${v.quantity === 0 ? 'text-danger' : 'text-brass-deep'}`}>{v.quantity === 0 ? 'Sold out' : `${v.quantity} left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Newest customers">
            <ul className="grid gap-2.5 text-[0.9375rem]">
              {stats.recentCustomers.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <Link href={`/admin/customers/${c.id}`} className="min-w-0 truncate hover:text-brass-deep">
                    {c.first_name ? `${c.first_name} ${c.last_name}` : c.email}
                  </Link>
                  <span className="shrink-0 text-mute">{day(c.created_at)}</span>
                </li>
              ))}
              {stats.recentCustomers.length === 0 && <li className="text-mute">No customer accounts yet.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
