import { query, queryOne } from './db';

export type ProductImage = { url: string; alt: string; color: string | null };
export type VariantSummary = { id: string; size: string; color: string; hex: string; qty: number; sku?: string };

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  priceCents: number;
  compareAtCents: number | null;
  badge: string | null;
  images: ProductImage[];
  variants: VariantSummary[];
  inStock: boolean;
};

export type ProductDetail = ProductCard & {
  description: string;
  material: string;
  materialDetails: string;
  care: string;
  fit: string;
  status: string;
  videoUrl: string | null;
  categories: { slug: string; name: string; kind: string }[];
  rating: { average: number; count: number };
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  kind: 'department' | 'type' | 'collection';
  description: string;
  imageUrl: string | null;
  isFeatured: boolean;
  productCount?: number;
};

export const SORTS = {
  featured: { label: 'Featured', sql: 'p.is_featured desc, p.popularity desc, p.name' },
  newest: { label: 'Newest', sql: 'p.published_at desc nulls last, p.name' },
  price_asc: { label: 'Price, low to high', sql: 'p.price_cents asc, p.name' },
  price_desc: { label: 'Price, high to low', sql: 'p.price_cents desc, p.name' },
  popular: { label: 'Most popular', sql: 'p.popularity desc, p.name' },
  best_selling: { label: 'Best selling', sql: 'p.sold_count desc, p.name' },
} as const;
export type SortKey = keyof typeof SORTS;

export type ProductFilters = {
  q?: string;
  department?: string[];
  type?: string[];
  collection?: string[];
  size?: string[];
  color?: string[];
  brand?: string[];
  material?: string[];
  minPrice?: number; // cents
  maxPrice?: number; // cents
  inStock?: boolean;
  onSale?: boolean;
  sort?: SortKey;
  page?: number;
  perPage?: number;
};

const CARD_COLUMNS = `
  p.id, p.slug, p.name, p.brand, p.price_cents, p.compare_at_cents, p.badge,
  (select coalesce(json_agg(json_build_object('url', i.url, 'alt', i.alt, 'color', i.color) order by i.sort_order), '[]'::json)
     from product_images i where i.product_id = p.id) as images,
  (select coalesce(json_agg(json_build_object('id', v.id, 'size', v.size, 'color', v.color, 'hex', v.color_hex,
                                               'qty', coalesce(inv.quantity, 0), 'sku', v.sku) order by v.sort_order), '[]'::json)
     from product_variants v left join inventory inv on inv.variant_id = v.id
    where v.product_id = p.id and v.is_active) as variants`;

type CardRow = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price_cents: number;
  compare_at_cents: number | null;
  badge: string | null;
  images: ProductImage[];
  variants: VariantSummary[];
};

function toCard(r: CardRow): ProductCard {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    brand: r.brand,
    priceCents: r.price_cents,
    compareAtCents: r.compare_at_cents,
    badge: r.badge,
    images: r.images,
    variants: r.variants,
    inStock: r.variants.some((v) => v.qty > 0),
  };
}

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
}

function buildWhere(f: ProductFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const cond: string[] = [`p.status = 'published'`];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const inCategory = (slugs: string[]) =>
    `exists (select 1 from product_categories pc join categories c on c.id = pc.category_id
              where pc.product_id = p.id and c.is_active and c.slug = any(${add(slugs)}::text[]))`;

  if (f.department?.length) cond.push(inCategory(f.department));
  if (f.type?.length) cond.push(inCategory(f.type));
  if (f.collection?.length) cond.push(inCategory(f.collection));
  if (f.size?.length)
    cond.push(
      `exists (select 1 from product_variants v where v.product_id = p.id and v.is_active and v.size = any(${add(f.size)}::text[]))`,
    );
  if (f.color?.length)
    cond.push(
      `exists (select 1 from product_variants v where v.product_id = p.id and v.is_active and v.color = any(${add(f.color)}::text[]))`,
    );
  if (f.brand?.length) cond.push(`p.brand = any(${add(f.brand)}::text[])`);
  if (f.material?.length) cond.push(`p.material = any(${add(f.material)}::text[])`);
  if (typeof f.minPrice === 'number') cond.push(`p.price_cents >= ${add(f.minPrice)}`);
  if (typeof f.maxPrice === 'number') cond.push(`p.price_cents <= ${add(f.maxPrice)}`);
  if (f.onSale) cond.push('p.compare_at_cents is not null');
  if (f.inStock)
    cond.push(
      `exists (select 1 from product_variants v join inventory inv on inv.variant_id = v.id
                where v.product_id = p.id and v.is_active and inv.quantity > 0)`,
    );
  if (f.q?.trim()) {
    const p = add(likePattern(f.q.trim().slice(0, 80)));
    cond.push(
      `(p.name ilike ${p} or p.description ilike ${p} or p.material ilike ${p} or p.brand ilike ${p}
        or exists (select 1 from product_categories pc join categories c on c.id = pc.category_id
                    where pc.product_id = p.id and c.name ilike ${p}))`,
    );
  }
  return { where: cond.join(' and '), params };
}

export async function listProducts(f: ProductFilters = {}) {
  const perPage = Math.min(Math.max(f.perPage ?? 12, 1), 48);
  const page = Math.max(f.page ?? 1, 1);
  const { where, params } = buildWhere(f);
  const sort = SORTS[f.sort ?? 'featured'] ?? SORTS.featured;
  const rows = await query<CardRow & { total: number }>(
    `select ${CARD_COLUMNS}, count(*) over() as total
       from products p
      where ${where}
      order by ${sort.sql}
      limit ${perPage} offset ${(page - 1) * perPage}`,
    params,
  );
  const total = rows[0]?.total ?? 0;
  return { products: rows.map(toCard), total, page, perPage, pages: Math.max(Math.ceil(total / perPage), 1) };
}

export async function getProductsByIds(ids: string[]): Promise<ProductCard[]> {
  if (!ids.length) return [];
  const rows = await query<CardRow>(
    `select ${CARD_COLUMNS} from products p
      where p.id = any($1::uuid[]) and p.status = 'published'
      order by array_position($1::uuid[], p.id)`,
    [ids],
  );
  return rows.map(toCard);
}

export async function getProductBySlug(slug: string, includeDrafts = false): Promise<ProductDetail | null> {
  const row = await queryOne<
    CardRow & {
      description: string;
      material: string;
      material_details: string;
      care: string;
      fit: string;
      status: string;
      video_url: string | null;
      categories: { slug: string; name: string; kind: string }[];
      rating_avg: string | null;
      rating_count: number;
    }
  >(
    `select ${CARD_COLUMNS}, p.description, p.material, p.material_details, p.care, p.fit, p.status, p.video_url,
            (select coalesce(json_agg(json_build_object('slug', c.slug, 'name', c.name, 'kind', c.kind) order by c.kind, c.sort_order), '[]'::json)
               from product_categories pc join categories c on c.id = pc.category_id where pc.product_id = p.id) as categories,
            (select avg(rating) from reviews r where r.product_id = p.id and r.status = 'published') as rating_avg,
            (select count(*) from reviews r where r.product_id = p.id and r.status = 'published') as rating_count
       from products p
      where p.slug = $1 ${includeDrafts ? '' : `and p.status = 'published'`}`,
    [slug],
  );
  if (!row) return null;
  return {
    ...toCard(row),
    description: row.description,
    material: row.material,
    materialDetails: row.material_details,
    care: row.care,
    fit: row.fit,
    status: row.status,
    videoUrl: row.video_url,
    categories: row.categories,
    rating: { average: row.rating_avg ? Number(row.rating_avg) : 0, count: row.rating_count },
  };
}

export async function getRelatedProducts(productId: string, limit = 4): Promise<ProductCard[]> {
  const rows = await query<CardRow>(
    `select ${CARD_COLUMNS}
       from products p
      where p.status = 'published' and p.id <> $1
      order by (select count(*) from product_categories a
                 join product_categories b on b.category_id = a.category_id
                where a.product_id = p.id and b.product_id = $1) desc,
               p.popularity desc
      limit ${Math.min(limit, 12)}`,
    [productId],
  );
  return rows.map(toCard);
}

export type Review = {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  isVerifiedPurchase: boolean;
  isDemo: boolean;
  createdAt: Date;
  productName?: string;
  productSlug?: string;
};

type ReviewRow = {
  id: string;
  author_name: string;
  rating: number;
  title: string;
  body: string;
  is_verified_purchase: boolean;
  is_demo: boolean;
  created_at: Date;
  product_name?: string;
  product_slug?: string;
};
const toReview = (r: ReviewRow): Review => ({
  id: r.id,
  authorName: r.author_name,
  rating: r.rating,
  title: r.title,
  body: r.body,
  isVerifiedPurchase: r.is_verified_purchase,
  isDemo: r.is_demo,
  createdAt: r.created_at,
  productName: r.product_name,
  productSlug: r.product_slug,
});

export async function getProductReviews(productId: string): Promise<Review[]> {
  const rows = await query<ReviewRow>(
    `select id, author_name, rating, title, body, is_verified_purchase, is_demo, created_at
       from reviews where product_id = $1 and status = 'published' order by created_at desc limit 30`,
    [productId],
  );
  return rows.map(toReview);
}

export async function getFeaturedReviews(limit = 3): Promise<Review[]> {
  const rows = await query<ReviewRow>(
    `select r.id, r.author_name, r.rating, r.title, r.body, r.is_verified_purchase, r.is_demo, r.created_at,
            p.name as product_name, p.slug as product_slug
       from reviews r join products p on p.id = r.product_id
      where r.status = 'published' and p.status = 'published' and r.rating >= 4
      order by length(r.body) desc, r.created_at desc limit ${Math.min(limit, 12)}`,
  );
  return rows.map(toReview);
}

// ---- Categories & facets ---------------------------------------------------

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  kind: Category['kind'];
  description: string;
  image_url: string | null;
  is_featured: boolean;
  product_count?: number;
};
const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  kind: r.kind,
  description: r.description,
  imageUrl: r.image_url,
  isFeatured: r.is_featured,
  productCount: r.product_count,
});

export async function listCategories(kind?: Category['kind']): Promise<Category[]> {
  const rows = await query<CategoryRow>(
    `select c.id, c.slug, c.name, c.kind, c.description, c.image_url, c.is_featured,
            (select count(*) from product_categories pc join products p on p.id = pc.product_id
              where pc.category_id = c.id and p.status = 'published') as product_count
       from categories c
      where c.is_active ${kind ? 'and c.kind = $1' : ''}
      order by c.kind, c.sort_order, c.name`,
    kind ? [kind] : [],
  );
  return rows.map(toCategory);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const row = await queryOne<CategoryRow>(
    `select id, slug, name, kind, description, image_url, is_featured from categories where slug = $1 and is_active`,
    [slug],
  );
  return row ? toCategory(row) : null;
}

export type Facets = {
  sizes: string[];
  colors: { name: string; hex: string }[];
  brands: string[];
  materials: string[];
  price: { min: number; max: number };
};

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'One size'];
function sortSizes(sizes: string[]): string[] {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s);
    if (i >= 0) return i;
    const n = Number(s);
    return Number.isFinite(n) ? 100 + n : 1000;
  };
  return [...sizes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Filter options available across the published catalogue. */
export async function getFacets(): Promise<Facets> {
  const [sizes, colors, brands, materials, price] = await Promise.all([
    query<{ size: string }>(
      `select distinct v.size from product_variants v join products p on p.id = v.product_id
        where p.status = 'published' and v.is_active`,
    ),
    query<{ color: string; hex: string }>(
      `select v.color, min(v.color_hex) as hex from product_variants v join products p on p.id = v.product_id
        where p.status = 'published' and v.is_active group by v.color order by v.color`,
    ),
    query<{ brand: string }>(`select distinct brand from products where status = 'published' order by brand`),
    query<{ material: string }>(
      `select distinct material from products where status = 'published' and material <> '' order by material`,
    ),
    queryOne<{ min: number | null; max: number | null }>(
      `select min(price_cents) as min, max(price_cents) as max from products where status = 'published'`,
    ),
  ]);
  return {
    sizes: sortSizes(sizes.map((s) => s.size)),
    colors: colors.map((c) => ({ name: c.color, hex: c.hex })),
    brands: brands.map((b) => b.brand),
    materials: materials.map((m) => m.material),
    price: { min: price?.min ?? 0, max: price?.max ?? 0 },
  };
}

export async function searchSuggestions(q: string) {
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return { products: [], categories: [] };
  const pattern = likePattern(term);
  const [{ products }, categories] = await Promise.all([
    listProducts({ q: term, perPage: 5, sort: 'popular' }),
    query<{ slug: string; name: string; kind: string }>(
      `select slug, name, kind from categories where is_active and name ilike $1 order by kind, sort_order limit 4`,
      [pattern],
    ),
  ]);
  return {
    products: products.map((p) => ({
      slug: p.slug,
      name: p.name,
      priceCents: p.priceCents,
      compareAtCents: p.compareAtCents,
      image: p.images[0]?.url ?? null,
    })),
    categories,
  };
}
