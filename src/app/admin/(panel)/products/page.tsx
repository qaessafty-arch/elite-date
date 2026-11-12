import Image from 'next/image';
import Link from 'next/link';
import { deleteProductAction, setProductStatusAction } from '@/app/admin/actions';
import { PageHeader, Pager, Panel, Status, TableWrap, td, th } from '@/components/admin/parts';
import { ConfirmButton } from '@/components/admin/ui';
import { ADMIN_PER_PAGE, adminProducts } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; deleted?: string }> }) {
  await requireAdmin('products.manage');
  const sp = await searchParams;
  const [{ rows, total, page }, settings] = await Promise.all([adminProducts({ q: sp.q, status: sp.status, page: Number(sp.page) || 1 }), getSettings()]);
  const money = (c: number) => formatMoney(c, settings.locale.currency, settings.locale.locale);
  const qs = (p: number) => `/admin/products?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader
        title="Products"
        description="Everything in the catalogue, published or not."
        actions={
          <Link href="/admin/products/new" className="btn btn-primary btn-sm">
            Add a product
          </Link>
        }
      />
      {sp.deleted && <p className="notice notice-ok mb-5" role="status">Product deleted.</p>}
      <Panel>
        <form className="mb-5 flex flex-wrap items-end gap-3" role="search">
          <label className="field min-w-48 flex-1">
            <span>Search by name or slug</span>
            <input name="q" defaultValue={sp.q} className="input min-h-10 py-1.5" />
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={sp.status ?? ''} className="input min-h-10 py-1.5">
              <option value="">All</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <button type="submit" className="btn btn-secondary btn-sm">
            Apply
          </button>
        </form>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-mute">No products match. Clear the search or add a product.</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[44rem] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={th}>Product</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={`${th} text-right`}>Price</th>
                  <th scope="col" className={`${th} text-right`}>Stock</th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className={`${td} font-normal`}>
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:text-brass-deep">
                        <span className="relative block h-14 w-11 shrink-0 overflow-hidden bg-sand">
                          {p.image && <Image src={p.image} alt="" fill sizes="44px" className="object-cover" unoptimized={p.image.startsWith('/media/')} />}
                        </span>
                        <span>
                          <span className="block font-semibold">{p.name}</span>
                          <span className="small text-mute">/{p.slug}</span>
                        </span>
                      </Link>
                    </th>
                    <td className={td}>
                      <Status value={p.status} />
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {money(p.price_cents)}
                      {p.compare_at_cents && <s className="small block text-mute">{money(p.compare_at_cents)}</s>}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {p.stock}
                      <span className="small block text-mute">{p.variants} variants</span>
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link href={`/admin/products/${p.id}`} className="small underline underline-offset-4">
                          Edit
                        </Link>
                        <form action={setProductStatusAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="status" value={p.status === 'published' ? 'draft' : 'published'} />
                          <button type="submit" className="small underline underline-offset-4">
                            {p.status === 'published' ? 'Unpublish' : 'Publish'}
                          </button>
                        </form>
                        <form action={deleteProductAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmButton message={`Delete ${p.name}? Its variants, stock and images go too. Past orders keep their record.`}>Delete</ConfirmButton>
                        </form>
                      </div>
                    </td>
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
