import Link from 'next/link';
import { PageHeader, Pager, Panel, Status, TableWrap, td, th } from '@/components/admin/parts';
import { ADMIN_PER_PAGE, adminCustomers } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Customers' };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin('customers.manage');
  const sp = await searchParams;
  const [{ rows, total, page }, settings] = await Promise.all([adminCustomers({ q: sp.q, page: Number(sp.page) || 1 }), getSettings()]);
  const qs = (p: number) => `/admin/customers?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Customers" description="Everyone with an account, including staff." />
      <Panel>
        <form className="mb-5 flex flex-wrap items-end gap-3" role="search">
          <label className="field min-w-48 flex-1">
            <span>Search by name or email</span>
            <input name="q" defaultValue={sp.q} className="input min-h-10 py-1.5" />
          </label>
          <button type="submit" className="btn btn-secondary btn-sm">Search</button>
        </form>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-mute">No accounts match.</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={th}>Customer</th>
                  <th scope="col" className={th}>Role</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={`${th} text-right`}>Orders</th>
                  <th scope="col" className={`${th} text-right`}>Spent</th>
                  <th scope="col" className={th}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <th scope="row" className={`${td} font-semibold`}>
                      <Link href={`/admin/customers/${c.id}`} className="hover:text-brass-deep">
                        {c.first_name ? `${c.first_name} ${c.last_name}` : c.email}
                      </Link>
                      <span className="small block max-w-[16rem] truncate font-normal text-mute">{c.email}</span>
                    </th>
                    <td className={td}>{c.role}</td>
                    <td className={td}><Status value={c.status} /></td>
                    <td className={`${td} text-right tabular-nums`}>{c.orders}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatMoney(c.spent, settings.locale.currency, settings.locale.locale)}</td>
                    <td className={`${td} text-mute`}>{c.created_at.toLocaleDateString(settings.locale.locale, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
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
