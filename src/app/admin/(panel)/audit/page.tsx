import { PageHeader, Pager, Panel, TableWrap, td, th } from '@/components/admin/parts';
import { auditLog } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Audit log' };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin('settings.manage');
  const sp = await searchParams;
  const { rows, total, page } = await auditLog({ q: sp.q, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Audit log" description="Every sensitive change: who did it, to what, and when. Entries cannot be edited." />
      <Panel>
        <form className="mb-5 flex flex-wrap items-end gap-3" role="search">
          <label className="field min-w-48 flex-1">
            <span>Filter by action, record type or person</span>
            <input name="q" defaultValue={sp.q} className="input min-h-10 py-1.5" placeholder="order, coupon, admin@…" />
          </label>
          <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
        </form>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-mute">No entries match.</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[44rem] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={th}>When</th>
                  <th scope="col" className={th}>Who</th>
                  <th scope="col" className={th}>Action</th>
                  <th scope="col" className={th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={`${td} whitespace-nowrap text-mute`}>{r.created_at.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className={`${td} max-w-[14rem] truncate`}>{r.actor_email ?? 'Customer or system'}</td>
                    <th scope="row" className={`${td} font-semibold`}>{r.action}</th>
                    <td className={`${td} small max-w-[24rem] break-words text-mute`}>
                      {Object.entries(r.details).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(', ') || r.entity_type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pager page={page} total={total} perPage={40} href={(p) => `/admin/audit?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
      </Panel>
    </>
  );
}
