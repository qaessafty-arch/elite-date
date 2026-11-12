import { saveProductAction } from '@/app/admin/actions';
import { ActionForm } from '@/components/ActionForm';
import type { AdminProduct } from '@/lib/admin';

type Cat = { id: string; name: string; kind: string };
const KINDS = [
  ['department', 'Departments'],
  ['type', 'Product types'],
  ['collection', 'Collections'],
] as const;

export function ProductForm({ product, categories, selected }: { product?: AdminProduct; categories: Cat[]; selected: string[] }) {
  const dollars = (c?: number | null) => (c === null || c === undefined ? '' : (c / 100).toFixed(2));
  return (
    <ActionForm
      action={saveProductAction}
      hidden={product ? { id: product.id } : {}}
      submitLabel={product ? 'Save product' : 'Create product'}
      fields={[
        { name: 'name', label: 'Name', defaultValue: product?.name },
        { name: 'slug', label: 'URL slug', defaultValue: product?.slug, required: false, hint: 'Leave empty to build it from the name. Lowercase letters, numbers and hyphens.', half: true },
        { name: 'brand', label: 'Brand', defaultValue: product?.brand ?? 'Halden', half: true },
        { name: 'description', label: 'Description', defaultValue: product?.description, textarea: true },
        { name: 'price', label: 'Price', defaultValue: dollars(product?.price_cents), half: true, placeholder: '135.00' },
        { name: 'compareAt', label: 'Original price, if discounted', defaultValue: dollars(product?.compare_at_cents), required: false, half: true, hint: 'Shown struck through. Must be higher than the price.' },
        { name: 'material', label: 'Material tag', defaultValue: product?.material, required: false, half: true, hint: 'One word used in filters, like Wool.' },
        { name: 'badge', label: 'Badge', defaultValue: product?.badge ?? '', required: false, half: true, hint: 'Short label on the product image, like New.' },
        { name: 'materialDetails', label: 'Material details', defaultValue: product?.material_details, required: false, textarea: true },
        { name: 'care', label: 'Care', defaultValue: product?.care, required: false },
        { name: 'fit', label: 'Fit note', defaultValue: product?.fit, required: false },
        { name: 'videoUrl', label: 'Product video URL', defaultValue: product?.video_url ?? '', required: false, type: 'url' },
        { name: 'status', label: 'Visibility', defaultValue: product?.status ?? 'draft', half: true, options: [{ value: 'draft', label: 'Draft, hidden from the store' }, { value: 'published', label: 'Published' }] },
        { name: 'featured', label: 'Feature on the homepage', checkbox: true, defaultChecked: product?.is_featured },
      ]}
    >
      <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-3">
        {KINDS.map(([kind, label]) => (
          <fieldset key={kind}>
            <legend className="label mb-2">{label}</legend>
            <ul className="grid gap-1.5">
              {categories.filter((c) => c.kind === kind).map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 text-[0.9375rem]">
                    <input type="checkbox" name="categories" value={c.id} defaultChecked={selected.includes(c.id)} className="h-4 w-4 accent-[var(--ink)]" />
                    {c.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>
    </ActionForm>
  );
}
