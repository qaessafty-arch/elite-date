'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';

export type FilterOption = { value: string; label: string; hex?: string };
export type FilterGroup = { key: string; label: string; options: FilterOption[]; swatches?: boolean };
type SortOption = { value: string; label: string };

/**
 * Catalogue filters. State lives in the URL, so filters survive pagination,
 * sorting, refresh and sharing. Changing any filter returns to page 1.
 */
export function Filters({
  groups,
  sorts,
  priceBounds,
  total,
  locked = [],
}: {
  groups: FilterGroup[];
  sorts: SortOption[];
  priceBounds: { min: number; max: number };
  total: number;
  locked?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const selected = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean);

  const push = (changes: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    sp.delete('page');
    for (const [k, v] of Object.entries(changes)) {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const toggle = (key: string, value: string) => {
    const cur = selected(key);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    push({ [key]: next.join(',') || null });
  };

  const visible = groups.filter((g) => !locked.includes(g.key) && g.options.length > 0);
  const chips: { key: string; value?: string; label: string }[] = [];
  for (const g of visible) for (const v of selected(g.key)) chips.push({ key: g.key, value: v, label: g.options.find((o) => o.value === v)?.label ?? v });
  if (params.get('min') || params.get('max'))
    chips.push({ key: 'price', label: `$${params.get('min') || priceBounds.min / 100} to $${params.get('max') || Math.ceil(priceBounds.max / 100)}` });
  if (params.get('stock') === '1') chips.push({ key: 'stock', label: 'In stock' });
  if (params.get('sale') === '1' && !locked.includes('sale')) chips.push({ key: 'sale', label: 'On sale' });

  const clearAll = () => {
    const changes: Record<string, null> = { min: null, max: null, stock: null };
    for (const g of visible) changes[g.key] = null;
    if (!locked.includes('sale')) changes.sale = null;
    push(changes);
  };
  const removeChip = (c: (typeof chips)[number]) => {
    if (c.key === 'price') push({ min: null, max: null });
    else if (c.value) toggle(c.key, c.value);
    else push({ [c.key]: null });
  };

  const sortValue = params.get('sort') ?? sorts[0].value;

  const body = (idPrefix: string) => (
    <div className={pending ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {visible.map((g, gi) => (
        <details key={g.key} open={gi < 3 || selected(g.key).length > 0} className="group border-b border-line py-1">
          <summary className="flex list-none items-center justify-between py-3 font-semibold [&::-webkit-details-marker]:hidden">
            <span>
              {g.label}
              {selected(g.key).length > 0 && <span className="ml-1.5 font-normal text-mute">({selected(g.key).length})</span>}
            </span>
            <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
          </summary>
          <fieldset className="pb-4">
            <legend className="sr-only">{g.label}</legend>
            {g.swatches ? (
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = selected(g.key).includes(o.value);
                  return (
                    <label key={o.value} className="cursor-pointer" title={o.label}>
                      <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(g.key, o.value)} />
                      <span
                        className="flex items-center gap-2 rounded-full border border-line-strong py-1 pl-1 pr-3 text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bone peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brass"
                      >
                        <span className="h-5 w-5 rounded-full border border-black/15" style={{ backgroundColor: o.hex }} />
                        {o.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : g.key === 'size' ? (
              <div className="flex flex-wrap gap-1.5">
                {g.options.map((o) => {
                  const on = selected(g.key).includes(o.value);
                  return (
                    <label key={o.value} className="cursor-pointer">
                      <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(g.key, o.value)} />
                      <span className="grid min-h-10 min-w-11 place-items-center rounded-[2px] border border-line-strong px-2 text-sm font-medium peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bone peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brass">
                        {o.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <ul className="grid gap-0.5">
                {g.options.map((o) => (
                  <li key={o.value}>
                    <label className="flex min-h-9 cursor-pointer items-center gap-3 text-[0.9375rem]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--ink)]"
                        checked={selected(g.key).includes(o.value)}
                        onChange={() => toggle(g.key, o.value)}
                      />
                      {o.label}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </details>
      ))}

      <details className="group border-b border-line py-1" open={!!(params.get('min') || params.get('max'))}>
        <summary className="flex list-none items-center justify-between py-3 font-semibold [&::-webkit-details-marker]:hidden">
          Price
          <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <form
          key={`${params.get('min')}-${params.get('max')}`}
          className="flex items-end gap-2 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            push({ min: String(fd.get('min') || '') || null, max: String(fd.get('max') || '') || null });
          }}
        >
          <label className="field flex-1">
            <span>From ($)</span>
            <input className="input min-h-10 py-1.5" name="min" type="number" inputMode="numeric" min={0} step={1} defaultValue={params.get('min') ?? ''} placeholder={String(Math.floor(priceBounds.min / 100))} id={`${idPrefix}-min`} />
          </label>
          <label className="field flex-1">
            <span>To ($)</span>
            <input className="input min-h-10 py-1.5" name="max" type="number" inputMode="numeric" min={0} step={1} defaultValue={params.get('max') ?? ''} placeholder={String(Math.ceil(priceBounds.max / 100))} id={`${idPrefix}-max`} />
          </label>
          <button type="submit" className="btn btn-secondary btn-sm">
            Apply
          </button>
        </form>
      </details>

      <div className="grid gap-1 py-4">
        <label className="flex min-h-9 cursor-pointer items-center gap-3 text-[0.9375rem]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={params.get('stock') === '1'} onChange={() => push({ stock: params.get('stock') === '1' ? null : '1' })} />
          In stock only
        </label>
        {!locked.includes('sale') && (
          <label className="flex min-h-9 cursor-pointer items-center gap-3 text-[0.9375rem]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={params.get('sale') === '1'} onChange={() => push({ sale: params.get('sale') === '1' ? null : '1' })} />
            On sale
          </label>
        )}
      </div>
    </div>
  );

  const sortSelect = (id: string) => (
    <label className="flex items-center gap-2 text-[0.9375rem]" htmlFor={id}>
      <span className="text-mute">Sort by</span>
      <select
        id={id}
        className="cursor-pointer rounded-[2px] border border-line-strong bg-transparent py-2 pl-3 pr-8 font-medium hover:border-ink"
        value={sortValue}
        onChange={(e) => push({ sort: e.target.value === sorts[0].value ? null : e.target.value })}
      >
        {sorts.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="col-span-full flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
        <button type="button" className="btn btn-secondary btn-sm lg:hidden" onClick={() => setOpen(true)}>
          <Icon name="filter" size={16} /> Filter{chips.length ? ` (${chips.length})` : ''}
        </button>
        <p className="text-[0.9375rem] text-mute max-lg:order-last max-lg:w-full" aria-live="polite">
          {total} {total === 1 ? 'product' : 'products'}
        </p>
        {sortSelect('sort-toolbar')}
      </div>

      {chips.length > 0 && (
        <ul className="col-span-full flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((c) => (
            <li key={`${c.key}-${c.value ?? ''}`}>
              <button type="button" onClick={() => removeChip(c)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-sand py-1 pl-3 pr-2 text-sm hover:bg-line">
                {c.label}
                <Icon name="close" size={14} />
                <span className="sr-only">Remove filter</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="small ml-1 underline underline-offset-4" onClick={clearAll}>
              Clear all filters
            </button>
          </li>
        </ul>
      )}

      {/* Desktop sidebar */}
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-h)+1rem)] max-h-[calc(100dvh-var(--header-h)-2rem)] overflow-y-auto pr-3">{body('side')}</div>
      </aside>

      {/* Mobile sheet */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filter"
        side="bottom"
        footer={
          <div className="flex gap-3 px-5 py-4">
            <button type="button" className="btn btn-secondary flex-1" onClick={clearAll} disabled={!chips.length}>
              Clear all
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={() => setOpen(false)}>
              Show {total} {total === 1 ? 'product' : 'products'}
            </button>
          </div>
        }
      >
        <div className="px-5 pb-2">{body('sheet')}</div>
      </Sheet>
    </>
  );
}
