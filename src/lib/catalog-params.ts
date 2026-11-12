import { SORTS, type ProductFilters, type SortKey } from './catalog';

export type RawParams = Record<string, string | string[] | undefined>;

export const MULTI_KEYS = ['department', 'type', 'collection', 'size', 'color', 'brand', 'material'] as const;
export type MultiKey = (typeof MULTI_KEYS)[number];

function list(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v.join(',') : (v ?? '');
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function dollars(v: string | string[] | undefined): number | undefined {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) : undefined;
}

/** Turns URL search params into validated catalogue filters. Unknown values are dropped. */
export function parseFilters(raw: RawParams, preset: Partial<ProductFilters> = {}): ProductFilters {
  const sort = (Array.isArray(raw.sort) ? raw.sort[0] : raw.sort) as SortKey | undefined;
  const page = Number(Array.isArray(raw.page) ? raw.page[0] : raw.page);
  const q = Array.isArray(raw.q) ? raw.q[0] : raw.q;
  const f: ProductFilters = {
    q: q?.trim().slice(0, 80) || undefined,
    minPrice: dollars(raw.min),
    maxPrice: dollars(raw.max),
    inStock: raw.stock === '1' || undefined,
    onSale: raw.sale === '1' || undefined,
    sort: sort && sort in SORTS ? sort : undefined,
    page: Number.isInteger(page) && page > 0 && page < 1000 ? page : 1,
  };
  for (const key of MULTI_KEYS) {
    const values = list(raw[key]);
    if (values.length) f[key] = values;
  }
  return { ...f, ...preset };
}

/** Query string for the same view with some params changed. Empty values remove the param. */
export function withParams(raw: RawParams, changes: Record<string, string | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v.join(',') : v;
    if (s) sp.set(k, s);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === '') sp.delete(k);
    else sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
