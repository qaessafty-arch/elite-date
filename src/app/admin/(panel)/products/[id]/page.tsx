import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addVariantsAction, deleteImageAction, deleteProductAction, deleteVariantAction, updateImageAction, updateVariantAction, uploadImageAction } from '@/app/admin/actions';
import { PageHeader, Panel, Status, TableWrap, td, th } from '@/components/admin/parts';
import { ProductForm } from '@/components/admin/ProductForm';
import { ConfirmButton, RowForm } from '@/components/admin/ui';
import { adminCategories, adminProduct, auditFor } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Edit product' };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin('products.manage');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [data, categories, history, sp] = await Promise.all([adminProduct(id), adminCategories(), auditFor('product', id), searchParams]);
  if (!data) notFound();
  const { product, images, variants, categoryIds } = data;
  const colors = [...new Map(variants.map((v) => [v.color, v.color_hex])).entries()];
  const totalStock = variants.reduce((s, v) => s + v.quantity, 0);

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${totalStock} in stock across ${variants.length} variants.`}
        actions={
          <>
            <Status value={product.status} />
            {product.status === 'published' && (
              <Link href={`/products/${product.slug}`} className="btn btn-secondary btn-sm" target="_blank">
                View in store
              </Link>
            )}
            <Link href="/admin/products" className="btn btn-secondary btn-sm">
              Back to products
            </Link>
          </>
        }
      />
      {sp.created && <p className="notice notice-ok mb-6" role="status">Product created. Add its colours, sizes and images below, then publish it.</p>}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Details">
          <ProductForm product={product} categories={categories} selected={categoryIds} />
        </Panel>

        <div className="grid content-start gap-6">
          <Panel title="Images">
            {images.length === 0 && <p className="mb-4 text-mute">No images yet. Upload at least one before publishing.</p>}
            <ul className="grid gap-4">
              {images.map((img) => (
                <li key={img.id} className="flex gap-4 border-b border-line pb-4">
                  <span className="relative block h-28 w-[5.25rem] shrink-0 overflow-hidden bg-sand">
                    <Image src={img.url} alt={img.alt} fill sizes="84px" className="object-cover" unoptimized={img.url.startsWith('/media/')} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <RowForm action={updateImageAction} hidden={{ id: img.id }} className="grid grid-cols-2 items-end gap-2">
                      <label className="field col-span-2">
                        <span>Alt text</span>
                        <input name="alt" defaultValue={img.alt} className="input min-h-10 py-1.5" maxLength={160} />
                      </label>
                      <label className="field">
                        <span>Colour</span>
                        <select name="color" defaultValue={img.color ?? ''} className="input min-h-10 py-1.5">
                          <option value="">All colours</option>
                          {colors.map(([c]) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Order</span>
                        <input name="sortOrder" type="number" min={0} max={999} defaultValue={img.sort_order} className="input min-h-10 py-1.5" />
                      </label>
                    </RowForm>
                    <form action={deleteImageAction} className="mt-1">
                      <input type="hidden" name="id" value={img.id} />
                      <ConfirmButton message="Delete this image?">Delete image</ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            <h3 className="label mb-2 mt-5">Upload an image</h3>
            <RowForm action={uploadImageAction} hidden={{ productId: product.id }} label="Upload" className="grid grid-cols-2 items-end gap-2" variant="btn-primary">
              <label className="field col-span-2">
                <span>File (JPEG, PNG or WebP, up to 5 MB)</span>
                <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="input py-2 text-sm file:mr-3 file:border-0 file:bg-sand file:px-3 file:py-1" />
              </label>
              <label className="field">
                <span>Alt text</span>
                <input name="alt" className="input min-h-10 py-1.5" maxLength={160} defaultValue={product.name} />
              </label>
              <label className="field">
                <span>Colour</span>
                <select name="color" className="input min-h-10 py-1.5" defaultValue="">
                  <option value="">All colours</option>
                  {colors.map(([c]) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </RowForm>
          </Panel>
        </div>
      </div>

      <Panel title="Variants and stock" className="mt-6">
        {variants.length === 0 ? (
          <p className="mb-5 text-mute">No variants yet. Add a colour and its sizes below. Customers can only buy products that have variants in stock.</p>
        ) : (
          <TableWrap>
            <table className="mb-6 w-full min-w-[46rem] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={th}>Colour</th>
                  <th scope="col" className={th}>Size</th>
                  <th scope="col" className={th}>SKU, stock, low-stock alert, on sale</th>
                  <th scope="col" className={th}><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border border-black/15" style={{ backgroundColor: v.color_hex }} />
                        {v.color}
                      </span>
                    </td>
                    <th scope="row" className={`${td} font-semibold`}>{v.size}</th>
                    <td className={td}>
                      <RowForm action={updateVariantAction} hidden={{ id: v.id, activeField: '1' }} className="flex flex-wrap items-center gap-2">
                        <input name="sku" defaultValue={v.sku} aria-label={`SKU for ${v.color} ${v.size}`} className="input min-h-9 w-44 py-1 text-sm" maxLength={60} />
                        <input name="quantity" type="number" min={0} defaultValue={v.quantity} aria-label={`Stock for ${v.color} ${v.size}`} className="input min-h-9 w-20 py-1 text-sm tabular-nums" />
                        <input name="threshold" type="number" min={0} defaultValue={v.low_stock_threshold} aria-label={`Low-stock alert level for ${v.color} ${v.size}`} className="input min-h-9 w-16 py-1 text-sm tabular-nums" />
                        <label className="small flex items-center gap-1.5">
                          <input type="checkbox" name="active" defaultChecked={v.is_active} className="h-4 w-4 accent-[var(--ink)]" /> On sale
                        </label>
                      </RowForm>
                    </td>
                    <td className={td}>
                      <form action={deleteVariantAction}>
                        <input type="hidden" name="id" value={v.id} />
                        <ConfirmButton message={`Remove ${v.color} ${v.size}?`}>Remove</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <h3 className="label mb-2">Add a colour with sizes</h3>
        <RowForm action={addVariantsAction} hidden={{ productId: product.id }} label="Add variants" variant="btn-primary" className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1.4fr_auto_auto]">
          <label className="field">
            <span>Colour name</span>
            <input name="color" data-reset className="input min-h-10 py-1.5" required maxLength={40} placeholder="Charcoal" />
          </label>
          <label className="field">
            <span>Swatch</span>
            <input name="colorHex" type="color" defaultValue="#3a3a3c" className="h-10 w-14 cursor-pointer rounded-[2px] border border-line-strong bg-paper p-1" />
          </label>
          <label className="field">
            <span>Sizes, separated by commas</span>
            <input name="sizes" className="input min-h-10 py-1.5" required placeholder="S, M, L, XL" />
          </label>
          <label className="field">
            <span>Stock each</span>
            <input name="quantity" type="number" min={0} defaultValue={0} className="input min-h-10 w-24 py-1.5" />
          </label>
        </RowForm>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="History">
          {history.length === 0 ? (
            <p className="text-mute">No changes recorded yet.</p>
          ) : (
            <ol className="grid gap-2 text-[0.9375rem]">
              {history.slice(0, 12).map((h) => (
                <li key={h.id} className="flex justify-between gap-4 border-b border-line pb-2">
                  <span>
                    <span className="font-medium">{h.action}</span>
                    <span className="small block text-mute">{h.actor_email ?? 'System'}</span>
                  </span>
                  <span className="small shrink-0 text-mute">{h.created_at.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="Delete product">
          <p className="text-mute">Removes the product, its variants, stock and images. Orders that included it keep their own record of what was bought.</p>
          <form action={deleteProductAction} className="mt-4">
            <input type="hidden" name="id" value={product.id} />
            <ConfirmButton message={`Delete ${product.name} for good?`} className="btn btn-secondary btn-sm border-danger text-danger hover:bg-danger hover:text-white">
              Delete this product
            </ConfirmButton>
          </form>
        </Panel>
      </div>
    </>
  );
}
