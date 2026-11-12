import { deleteCategoryAction, saveCategoryAction } from '@/app/admin/actions';
import { ActionForm, type FieldSpec } from '@/components/ActionForm';
import { PageHeader, Panel, Status } from '@/components/admin/parts';
import { ConfirmButton } from '@/components/admin/ui';
import { adminCategories } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Categories' };

type Cat = Awaited<ReturnType<typeof adminCategories>>[number];
const KIND_LABEL: Record<string, string> = { department: 'Departments', type: 'Product types', collection: 'Collections' };

function fields(c?: Cat): FieldSpec[] {
  return [
    { name: 'name', label: 'Name', defaultValue: c?.name, half: true },
    { name: 'slug', label: 'URL slug', defaultValue: c?.slug, required: false, half: true, hint: 'Leave empty to build it from the name.' },
    { name: 'kind', label: 'Kind', defaultValue: c?.kind ?? 'type', half: true, options: [{ value: 'department', label: 'Department' }, { value: 'type', label: 'Product type' }, { value: 'collection', label: 'Collection' }] },
    { name: 'sortOrder', label: 'Position', type: 'number', min: '0', defaultValue: String(c?.sort_order ?? 0), half: true },
    { name: 'description', label: 'Description', defaultValue: c?.description, required: false },
    { name: 'imageUrl', label: 'Image URL', defaultValue: c?.image_url ?? '', required: false, hint: 'Used for collection tiles. A path like /images/collections/x.jpg or an https URL.' },
    { name: 'active', label: 'Show in the store', checkbox: true, defaultChecked: c ? c.is_active : true },
    { name: 'featured', label: 'Feature on the homepage (collections)', checkbox: true, defaultChecked: c?.is_featured },
  ];
}

export default async function CategoriesPage() {
  await requireAdmin('products.manage');
  const categories = await adminCategories();
  return (
    <>
      <PageHeader title="Categories" description="Departments, product types and collections drive the menu, the filters and the collection pages." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid gap-6">
          {Object.entries(KIND_LABEL).map(([kind, label]) => (
            <Panel key={kind} title={label}>
              <ul className="grid">
                {categories.filter((c) => c.kind === kind).map((c) => (
                  <li key={c.id} className="border-b border-line py-1 last:border-0">
                    <details>
                      <summary className="flex flex-wrap items-center justify-between gap-3 py-2">
                        <span>
                          <span className="font-semibold">{c.name}</span>
                          <span className="small ml-2 text-mute">/c/{c.slug}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="small text-mute">{c.products} products</span>
                          {!c.is_active && <Status value="draft" label="Hidden" />}
                          <span className="small underline underline-offset-4">Edit</span>
                        </span>
                      </summary>
                      <div className="pb-5 pt-3">
                        <ActionForm action={saveCategoryAction} hidden={{ id: c.id }} submitLabel="Save category" fields={fields(c)} />
                        <form action={deleteCategoryAction} className="mt-3">
                          <input type="hidden" name="id" value={c.id} />
                          <ConfirmButton message={`Delete ${c.name}? Products stay, but lose this category.`}>Delete category</ConfirmButton>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
        <Panel title="Add a category" className="self-start">
          <ActionForm action={saveCategoryAction} submitLabel="Add category" resetOnSuccess fields={fields()} />
        </Panel>
      </div>
    </>
  );
}
