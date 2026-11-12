import { query, queryOne } from './db';

/** Read models for the admin area. Every caller must have passed requireAdmin() first. */

export async function dashboardStats() {
  const [totals, lowStock, daily, bestSellers, recentPayments, recentCustomers] = await Promise.all([
    queryOne<{ revenue: number; orders: number; products: number; open_orders: number; low_stock: number; customers: number }>(
      `select
         (select coalesce(sum(amount_cents - refunded_cents), 0) from payments where status in ('succeeded', 'partially_refunded', 'refunded')) as revenue,
         (select count(*) from orders where status <> 'cancelled') as orders,
         (select count(*) from products where status = 'published') as products,
         (select count(*) from orders where status in ('pending', 'confirmed', 'processing')) as open_orders,
         (select count(*) from inventory i join product_variants v on v.id = i.variant_id where v.is_active and i.quantity <= i.low_stock_threshold) as low_stock,
         (select count(*) from users u join roles r on r.id = u.role_id where r.key = 'customer') as customers`,
    ),
    query<{ product_id: string; name: string; color: string; size: string; quantity: number }>(
      `select p.id as product_id, p.name, v.color, v.size, i.quantity
         from inventory i join product_variants v on v.id = i.variant_id join products p on p.id = v.product_id
        where v.is_active and i.quantity <= i.low_stock_threshold
        order by i.quantity, p.name limit 8`,
    ),
    query<{ day: Date; revenue: number; orders: number }>(
      `select d::date as day,
              coalesce(sum(o.total_cents) filter (where o.payment_status in ('paid', 'partially_refunded')), 0) as revenue,
              count(o.id) filter (where o.status <> 'cancelled') as orders
         from generate_series(current_date - interval '29 days', current_date, interval '1 day') d
         left join orders o on o.created_at::date = d::date
        group by d order by d`,
    ),
    query<{ id: string; name: string; units: number; revenue: number }>(
      `select p.id, p.name, sum(oi.quantity) as units, sum(oi.line_total_cents) as revenue
         from order_items oi join orders o on o.id = oi.order_id join products p on p.id = oi.product_id
        where o.status <> 'cancelled' and o.payment_status in ('paid', 'partially_refunded')
        group by p.id, p.name order by units desc limit 5`,
    ),
    query<{ order_id: string; number: string; provider: string; status: string; amount_cents: number; refunded_cents: number; created_at: Date; email: string }>(
      `select o.id as order_id, o.number, pay.provider, pay.status, pay.amount_cents, pay.refunded_cents, pay.created_at, o.email::text as email
         from payments pay join orders o on o.id = pay.order_id order by pay.created_at desc limit 8`,
    ),
    query<{ id: string; email: string; first_name: string | null; last_name: string | null; created_at: Date }>(
      `select u.id, u.email::text as email, p.first_name, p.last_name, u.created_at
         from users u join roles r on r.id = u.role_id left join profiles p on p.user_id = u.id
        where r.key = 'customer' order by u.created_at desc limit 5`,
    ),
  ]);
  return { totals: totals!, lowStock, daily, bestSellers, recentPayments, recentCustomers };
}

const like = (q: string) => `%${q.trim().slice(0, 80).replace(/[\\%_]/g, (c) => '\\' + c)}%`;
const PER_PAGE = 20;
export const ADMIN_PER_PAGE = PER_PAGE;

export async function adminProducts(opts: { q?: string; status?: string; page?: number }) {
  const params: unknown[] = [];
  const cond: string[] = [];
  if (opts.q?.trim()) {
    params.push(like(opts.q));
    cond.push(`(p.name ilike $${params.length} or p.slug ilike $${params.length})`);
  }
  if (opts.status === 'draft' || opts.status === 'published') {
    params.push(opts.status);
    cond.push(`p.status = $${params.length}`);
  }
  const page = Math.max(opts.page ?? 1, 1);
  const rows = await query<{
    id: string; slug: string; name: string; status: string; price_cents: number; compare_at_cents: number | null;
    stock: number; variants: number; image: string | null; total: number;
  }>(
    `select p.id, p.slug, p.name, p.status, p.price_cents, p.compare_at_cents,
            (select coalesce(sum(i.quantity), 0) from product_variants v join inventory i on i.variant_id = v.id where v.product_id = p.id) as stock,
            (select count(*) from product_variants v where v.product_id = p.id) as variants,
            (select url from product_images i where i.product_id = p.id order by sort_order limit 1) as image,
            count(*) over() as total
       from products p ${cond.length ? 'where ' + cond.join(' and ') : ''}
      order by p.updated_at desc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    params,
  );
  return { rows, total: rows[0]?.total ?? 0, page };
}

export type AdminProduct = {
  id: string; slug: string; name: string; description: string; brand: string; material: string; material_details: string;
  care: string; fit: string; price_cents: number; compare_at_cents: number | null; status: string; badge: string | null;
  is_featured: boolean; video_url: string | null;
};

export async function adminProduct(id: string) {
  const product = await queryOne<AdminProduct>('select * from products where id = $1', [id]);
  if (!product) return null;
  const [images, variants, categoryIds] = await Promise.all([
    query<{ id: string; url: string; alt: string; color: string | null; sort_order: number }>(
      'select id, url, alt, color, sort_order from product_images where product_id = $1 order by sort_order, id',
      [id],
    ),
    query<{ id: string; sku: string; size: string; color: string; color_hex: string; is_active: boolean; quantity: number; low_stock_threshold: number }>(
      `select v.id, v.sku, v.size, v.color, v.color_hex, v.is_active, coalesce(i.quantity, 0) as quantity, coalesce(i.low_stock_threshold, 5) as low_stock_threshold
         from product_variants v left join inventory i on i.variant_id = v.id where v.product_id = $1 order by v.sort_order, v.color, v.size`,
      [id],
    ),
    query<{ category_id: string }>('select category_id from product_categories where product_id = $1', [id]),
  ]);
  return { product, images, variants, categoryIds: categoryIds.map((c) => c.category_id) };
}

export async function adminCategories() {
  return query<{
    id: string; slug: string; name: string; kind: string; description: string; image_url: string | null;
    sort_order: number; is_active: boolean; is_featured: boolean; products: number;
  }>(
    `select c.*, (select count(*) from product_categories pc where pc.category_id = c.id) as products
       from categories c order by c.kind, c.sort_order, c.name`,
  );
}

export async function adminInventory(opts: { q?: string; low?: boolean }) {
  const params: unknown[] = [];
  const cond: string[] = [];
  if (opts.q?.trim()) {
    params.push(like(opts.q));
    cond.push(`(p.name ilike $1 or v.sku ilike $1)`);
  }
  if (opts.low) cond.push('coalesce(i.quantity, 0) <= coalesce(i.low_stock_threshold, 5)');
  return query<{ id: string; product_id: string; name: string; sku: string; size: string; color: string; quantity: number; low_stock_threshold: number; is_active: boolean }>(
    `select v.id, p.id as product_id, p.name, v.sku, v.size, v.color, coalesce(i.quantity, 0) as quantity,
            coalesce(i.low_stock_threshold, 5) as low_stock_threshold, v.is_active
       from product_variants v join products p on p.id = v.product_id left join inventory i on i.variant_id = v.id
      ${cond.length ? 'where ' + cond.join(' and ') : ''}
      order by p.name, v.sort_order limit 400`,
    params,
  );
}

export async function adminOrders(opts: { q?: string; status?: string; payment?: string; page?: number }) {
  const params: unknown[] = [];
  const cond: string[] = [];
  if (opts.q?.trim()) {
    params.push(like(opts.q));
    cond.push(`(o.number ilike $${params.length} or o.email::text ilike $${params.length} or (o.first_name || ' ' || o.last_name) ilike $${params.length})`);
  }
  if (opts.status) {
    params.push(opts.status);
    cond.push(`o.status = $${params.length}`);
  }
  if (opts.payment) {
    params.push(opts.payment);
    cond.push(`o.payment_status = $${params.length}`);
  }
  const page = Math.max(opts.page ?? 1, 1);
  const rows = await query<{
    id: string; number: string; email: string; first_name: string; last_name: string; status: string; payment_status: string;
    total_cents: number; currency: string; created_at: Date; items: number; total: number;
  }>(
    `select o.id, o.number, o.email::text as email, o.first_name, o.last_name, o.status, o.payment_status, o.total_cents, o.currency, o.created_at,
            (select coalesce(sum(quantity), 0) from order_items oi where oi.order_id = o.id) as items, count(*) over() as total
       from orders o ${cond.length ? 'where ' + cond.join(' and ') : ''}
      order by o.created_at desc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    params,
  );
  return { rows, total: rows[0]?.total ?? 0, page };
}

export async function orderPayments(orderId: string) {
  return query<{ id: string; provider: string; provider_ref: string | null; amount_cents: number; refunded_cents: number; status: string; created_at: Date }>(
    'select id, provider, provider_ref, amount_cents, refunded_cents, status, created_at from payments where order_id = $1 order by created_at',
    [orderId],
  );
}

export type AuditRow = { id: number; actor_email: string | null; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: Date };

export async function auditFor(entityType: string, entityId: string) {
  return query<AuditRow>(
    'select id, actor_email, action, entity_type, entity_id, details, created_at from audit_logs where entity_type = $1 and entity_id = $2 order by created_at desc limit 100',
    [entityType, entityId],
  );
}

export async function auditLog(opts: { q?: string; page?: number }) {
  const page = Math.max(opts.page ?? 1, 1);
  const params: unknown[] = [];
  let where = '';
  if (opts.q?.trim()) {
    params.push(like(opts.q));
    where = `where action ilike $1 or entity_type ilike $1 or actor_email ilike $1`;
  }
  const rows = await query<AuditRow & { total: number }>(
    `select id, actor_email, action, entity_type, entity_id, details, created_at, count(*) over() as total
       from audit_logs ${where} order by created_at desc limit 40 offset ${(page - 1) * 40}`,
    params,
  );
  return { rows, total: rows[0]?.total ?? 0, page };
}

export async function adminCustomers(opts: { q?: string; page?: number }) {
  const page = Math.max(opts.page ?? 1, 1);
  const params: unknown[] = [];
  let extra = '';
  if (opts.q?.trim()) {
    params.push(like(opts.q));
    extra = `where u.email::text ilike $1 or (coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike $1`;
  }
  const rows = await query<{
    id: string; email: string; first_name: string | null; last_name: string | null; status: string; role: string; created_at: Date;
    orders: number; spent: number; total: number;
  }>(
    `select u.id, u.email::text as email, p.first_name, p.last_name, u.status, r.name as role, u.created_at,
            (select count(*) from orders o where o.user_id = u.id and o.status <> 'cancelled') as orders,
            (select coalesce(sum(total_cents), 0) from orders o where o.user_id = u.id and o.payment_status in ('paid', 'partially_refunded')) as spent,
            count(*) over() as total
       from users u join roles r on r.id = u.role_id left join profiles p on p.user_id = u.id
       ${extra}
      order by u.created_at desc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    params,
  );
  return { rows, total: rows[0]?.total ?? 0, page };
}

export async function adminCustomer(id: string) {
  const user = await queryOne<{
    id: string; email: string; status: string; role_id: number; role: string; role_key: string; created_at: Date; last_login_at: Date | null;
    email_verified_at: Date | null; first_name: string | null; last_name: string | null; phone: string | null;
  }>(
    `select u.id, u.email::text as email, u.status, u.role_id, r.name as role, r.key as role_key, u.created_at, u.last_login_at, u.email_verified_at,
            p.first_name, p.last_name, p.phone
       from users u join roles r on r.id = u.role_id left join profiles p on p.user_id = u.id where u.id = $1`,
    [id],
  );
  if (!user) return null;
  const [orders, addresses] = await Promise.all([
    query<{ id: string; number: string; status: string; payment_status: string; total_cents: number; currency: string; created_at: Date }>(
      'select id, number, status, payment_status, total_cents, currency, created_at from orders where user_id = $1 order by created_at desc limit 50',
      [id],
    ),
    query<{ id: string; label: string; line1: string; city: string; postal_code: string; country: string; is_default: boolean }>(
      'select id, label, line1, city, postal_code, country, is_default from addresses where user_id = $1 order by is_default desc',
      [id],
    ),
  ]);
  return { user, orders, addresses };
}

export async function adminCoupons() {
  return query<{
    id: string; code: string; description: string; campaign: string; kind: 'percent' | 'fixed'; value: number; min_subtotal_cents: number;
    starts_at: Date | null; expires_at: Date | null; usage_limit: number | null; used_count: number; is_active: boolean;
  }>(`select id, code::text as code, description, campaign, kind, value, min_subtotal_cents, starts_at, expires_at, usage_limit, used_count, is_active
        from coupons order by campaign, created_at desc`);
}

export async function adminRoles() {
  return query<{ id: number; key: string; name: string; permissions: string[]; users: number }>(
    `select r.id, r.key, r.name, r.permissions, (select count(*) from users u where u.role_id = r.id) as users from roles r order by r.id`,
  );
}

export async function adminShippingMethods() {
  return query<{ id: string; code: string; name: string; description: string; price_cents: number; free_over_cents: number | null; min_days: number; max_days: number; is_active: boolean; sort_order: number }>(
    'select * from shipping_methods order by sort_order, name',
  );
}
