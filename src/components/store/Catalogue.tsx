import Link from 'next/link';
import { getFacets, listCategories, listProducts, SORTS, type ProductFilters } from '@/lib/catalog';
import { parseFilters, withParams, type RawParams } from '@/lib/catalog-params';
import { Filters, type FilterGroup } from './Filters';
import { ProductGrid } from './ProductCard';

/**
 * The shared listing view behind /shop, /c/[slug], /sale and /search.
 * `preset` pins filters for the page (e.g. department=men) and hides their controls.
 */
export async function Catalogue({
  title,
  description,
  searchParams,
  basePath,
  preset = {},
  locked = [],
  breadcrumb,
  emptyHint,
}: {
  title: string;
  description?: string;
  searchParams: RawParams;
  basePath: string;
  preset?: Partial<ProductFilters>;
  locked?: string[];
  breadcrumb?: { label: string; href: string }[];
  emptyHint?: React.ReactNode;
}) {
  const filters = parseFilters(searchParams, preset);
  const [result, facets, categories] = await Promise.all([listProducts(filters), getFacets(), listCategories()]);
  const byKind = (kind: string) => categories.filter((c) => c.kind === kind).map((c) => ({ value: c.slug, label: c.name }));

  const groups: FilterGroup[] = [
    { key: 'type', label: 'Category', options: byKind('type') },
    { key: 'department', label: 'Department', options: byKind('department') },
    { key: 'size', label: 'Size', options: facets.sizes.map((s) => ({ value: s, label: s })) },
    { key: 'color', label: 'Colour', swatches: true, options: facets.colors.map((c) => ({ value: c.name, label: c.name, hex: c.hex })) },
    { key: 'collection', label: 'Collection', options: byKind('collection') },
    { key: 'material', label: 'Material', options: facets.materials.map((m) => ({ value: m, label: m })) },
    { key: 'brand', label: 'Brand', options: facets.brands.map((b) => ({ value: b, label: b })) },
  ];

  const pageHref = (page: number) => `${basePath}${withParams(searchParams, { page: page > 1 ? String(page) : null })}`;
  const { page, pages, total } = result;
  const window = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);

  return (
    <div className="shell pb-8 pt-8 md:pt-12">
      {breadcrumb && (
        <nav aria-label="Breadcrumb" className="small mb-5 text-mute">
          <ol className="flex flex-wrap gap-x-2">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            {breadcrumb.map((b) => (
              <li key={b.href} className="flex gap-x-2">
                <span aria-hidden="true">/</span>
                <Link href={b.href} className="hover:text-ink">
                  {b.label}
                </Link>
              </li>
            ))}
            <li className="flex gap-x-2 text-ink" aria-current="page">
              <span aria-hidden="true">/</span>
              {title}
            </li>
          </ol>
        </nav>
      )}
      <header className="mb-8 md:mb-10">
        <h1 className="display display-lg">{title}</h1>
        {description && <p className="lede mt-3">{description}</p>}
      </header>

      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[15rem_1fr]">
        <Filters
          groups={groups}
          sorts={Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label }))}
          priceBounds={facets.price}
          total={total}
          locked={locked}
        />
        <div>
          {result.products.length === 0 ? (
            <div className="border border-line bg-paper px-6 py-16 text-center">
              <p className="display display-md">Nothing matches those filters.</p>
              <p className="mx-auto mt-3 max-w-md text-mute">
                {emptyHint ?? 'Remove a filter or two, or clear them all to see the full range again.'}
              </p>
              <Link href={basePath} className="btn btn-primary mt-6">
                Clear filters
              </Link>
            </div>
          ) : (
            <ProductGrid products={result.products} priorityCount={4} />
          )}

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-1.5">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="btn btn-secondary btn-sm" rel="prev">
                  Previous
                </Link>
              ) : (
                <span className="btn btn-secondary btn-sm opacity-40" aria-disabled="true">
                  Previous
                </span>
              )}
              <ol className="mx-2 flex items-center gap-1">
                {window.map((p, i) => (
                  <li key={p} className="flex items-center gap-1">
                    {i > 0 && window[i - 1] !== p - 1 && <span className="px-1 text-mute">…</span>}
                    <Link
                      href={pageHref(p)}
                      aria-current={p === page ? 'page' : undefined}
                      aria-label={`Page ${p}`}
                      className={`grid h-10 w-10 place-items-center rounded-[2px] text-sm font-medium ${
                        p === page ? 'bg-ink text-bone' : 'hover:bg-sand'
                      }`}
                    >
                      {p}
                    </Link>
                  </li>
                ))}
              </ol>
              {page < pages ? (
                <Link href={pageHref(page + 1)} className="btn btn-secondary btn-sm" rel="next">
                  Next
                </Link>
              ) : (
                <span className="btn btn-secondary btn-sm opacity-40" aria-disabled="true">
                  Next
                </span>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
