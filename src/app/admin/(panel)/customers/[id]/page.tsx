import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setCustomerRoleAction, setCustomerStatusAction } from '@/app/admin/actions';
import { PageHeader, Panel, Status, TableWrap, td, th } from '@/components/admin/parts';
import { RowForm } from '@/components/admin/ui';
import { adminCustomer, adminRoles } from '@/lib/admin';
import { can, requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/lib/orders';
import { COUNTRY_NAMES, getSettings } from '@/lib/settings';

export const metadata = { title: 'Customer' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin('customers.manage');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [data, settings, roles] = await Promise.all([adminCustomer(id), getSettings(), adminRoles()]);
  if (!data) notFound();
  const { user, orders, addresses } = data;
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString(settings.locale.locale, { dateStyle: 'medium' }) : 'Never');
  const spent = orders.filter((o) => ['paid', 'partially_refunded'].includes(o.payment_status)).reduce((s, o) => s + o.total_cents, 0);
  const isSelf = user.id === actor.id;

  return (
    <>
      <PageHeader
        title={user.first_name ? `${user.first_name} ${user.last_name}` : user.email}
        description={user.email}
        actions={
          <>
            <Status value={user.status} />
            <Link href="/admin/customers" className="btn btn-secondary btn-sm">Back to customers</Link>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title={`Purchase history, ${formatMoney(spent, settings.locale.currency, settings.locale.locale)} spent`}>
          {orders.length === 0 ? (
            <p className="text-mute">No orders yet.</p>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[28rem] border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className={th}>Order</th>
                    <th scope="col" className={th}>Date</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <th scope="row" className={`${td} font-semibold`}>
                        {can(actor, 'orders.manage') ? <Link href={`/admin/orders/${o.id}`} className="hover:text-brass-deep">{o.number}</Link> : o.number}
                      </th>
                      <td className={`${td} text-mute`}>{fmt(o.created_at)}</td>
                      <td className={td}><Status value={o.status} label={ORDER_STATUS_LABEL[o.status as OrderStatus]} /></td>
                      <td className={`${td} text-right tabular-nums`}>{formatMoney(o.total_cents, o.currency, settings.locale.locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
        <div className="grid content-start gap-6">
          <Panel title="Account">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[0.9375rem]">
              <dt className="text-mute">Role</dt><dd>{user.role}</dd>
              <dt className="text-mute">Joined</dt><dd>{fmt(user.created_at)}</dd>
              <dt className="text-mute">Last sign-in</dt><dd>{fmt(user.last_login_at)}</dd>
              <dt className="text-mute">Email</dt><dd>{user.email_verified_at ? 'Confirmed' : 'Not confirmed'}</dd>
              {user.phone && (<><dt className="text-mute">Phone</dt><dd>{user.phone}</dd></>)}
            </dl>
            {isSelf ? (
              <p className="small mt-4 text-mute">This is your own account, so you cannot suspend it or change its role here.</p>
            ) : (
              <>
                <div className="mt-5 border-t border-line pt-4">
                  <RowForm
                    action={setCustomerStatusAction}
                    hidden={{ id: user.id, status: user.status === 'active' ? 'suspended' : 'active' }}
                    label={user.status === 'active' ? 'Suspend account' : 'Reactivate account'}
                  />
                  <p className="small text-mute">Suspending signs the customer out everywhere and blocks sign-in. Their order history is kept.</p>
                </div>
                {can(actor, 'roles.manage') && (
                  <div className="mt-5 border-t border-line pt-4">
                    <RowForm action={setCustomerRoleAction} hidden={{ id: user.id }} label="Change role">
                      <label className="field">
                        <span>Role</span>
                        <select name="roleId" defaultValue={String(user.role_id)} className="input min-h-10 py-1.5">
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </label>
                    </RowForm>
                  </div>
                )}
              </>
            )}
          </Panel>
          <Panel title="Saved addresses">
            {addresses.length === 0 ? (
              <p className="text-mute">None saved.</p>
            ) : (
              <ul className="grid gap-3 text-[0.9375rem]">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold">{a.label}</span>
                    {a.is_default && <span className="small ml-2 text-mute">Default</span>}
                    <span className="block text-mute">{a.line1}, {a.city} {a.postal_code}, {COUNTRY_NAMES[a.country] ?? a.country}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
