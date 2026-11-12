import Link from 'next/link';
import { updateVariantAction } from '@/app/admin/actions';
import { PageHeader, Panel, TableWrap, td, th } from '@/components/admin/parts';
import { RowForm } from '@/components/admin/ui';
import { adminInventory } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Inventory' };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string }> }) {
  await requireAdmin('products.manage');
  const sp = await searchParams;
  const rows = await adminInventory({ q: sp.q, low: sp.low === '1' });
  return (
    <>
      <PageHeader title="Inventory" description="Stock is tracked for every colour and size. Orders reduce it automatically, and cancelled orders put it back." />
      <Panel>
        <form className="mb-5 flex flex-wrap items-end gap-3" role="search">
          <label className="field min-w-48 flex-1">
            <span>Search by product or SKU</span>
            <input name="q" defaultValue={sp.q} className="input min-h-10 py-1.5" />
          </label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-[0.9375rem]">
            <input type="checkbox" name="low" value="1" defaultChecked={sp.low === '1'} className="h-4 w-4 accent-[var(--ink)]" />
            Low stock only
          </label>
          <button type="submit" className="btn btn-secondary btn-sm">
            Apply
          </button>
        </form>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-mute">{sp.low === '1' ? 'Nothing is running low.' : 'No variants match.'}</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={th}>Product</th>
                  <th scope="col" className={th}>Variant</th>
                  <th scope="col" className={th}>SKU</th>
                  <th scope="col" className={th}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const low = v.quantity <= v.low_stock_threshold;
                  return (
                    <tr key={v.id}>
                      <th scope="row" className={`${td} font-semibold`}>
                        <Link href={`/admin/products/${v.product_id}`} className="hover:text-brass-deep">
                          {v.name}
                        </Link>
                      </th>
                      <td className={td}>
                        {v.color}, {v.size}
                        {!v.is_active && <span className="small ml-2 text-mute">(off sale)</span>}
                      </td>
                      <td className={`${td} small text-mute`}>{v.sku}</td>
                      <td className={td}>
                        <RowForm action={updateVariantAction} hidden={{ id: v.id }} className="flex flex-wrap items-center gap-2">
                          <input name="quantity" type="number" min={0} defaultValue={v.quantity} aria-label={`Stock for ${v.name} ${v.color} ${v.size}`} className={`input min-h-9 w-20 py-1 text-sm tabular-nums ${low ? 'border-brass' : ''}`} />
                          {low && <span className={`small font-semibold ${v.quantity === 0 ? 'text-danger' : 'text-brass-deep'}`}>{v.quantity === 0 ? 'Sold out' : 'Low'}</span>}
                        </RowForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
