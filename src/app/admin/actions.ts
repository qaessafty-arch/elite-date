'use server';

import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import sharp from 'sharp';
import { z } from 'zod';
import type { ActionState } from '@/components/ActionForm';
import { audit } from '@/lib/audit';
import { assertPermission } from '@/lib/auth';
import { zodFieldErrors } from '@/lib/checkout-schema';
import { query, queryOne, transaction } from '@/lib/db';
import { cancelOrder, markOrderPaid, OrderError } from '@/lib/orders';
import { demoPaymentsAllowed, refundOrder, RefundError } from '@/lib/payments';
import { PERMISSIONS } from '@/lib/permissions';
import { COUNTRY_NAMES, saveSetting, type StoreSettings } from '@/lib/settings';

/**
 * Every action here starts with assertPermission(), validates its input with zod,
 * and writes an audit entry. Nothing from the browser is trusted.
 */

const uuid = z.string().uuid();
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.').max(80);
const money = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/, 'Enter an amount like 135 or 135.50.')
  .transform((v) => Math.round(Number(v) * 100));
const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{1,7}(\.\d{1,2})?$/.test(v), 'Enter an amount like 135 or 135.50, or leave it empty.')
  .transform((v) => (v === '' ? null : Math.round(Number(v) * 100)));
const text = (max: number) => z.string().trim().max(max);
const fail = (err: z.ZodError): ActionState => ({ ok: false, message: 'Check the highlighted fields.', fields: zodFieldErrors(err) });
const data = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const isUnique = (err: unknown) => (err as { code?: string }).code === '23505';

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const productSchema = z.object({
  id: uuid.optional(),
  name: text(120).min(2, 'Enter a product name.'),
  slug: z.string().trim().max(80).optional(),
  description: text(4000),
  brand: text(80).min(1, 'Enter a brand.'),
  material: text(60),
  materialDetails: text(1000),
  care: text(1000),
  fit: text(400),
  price: money,
  compareAt: optionalMoney,
  badge: text(24),
  videoUrl: z.string().trim().max(400).refine((v) => v === '' || /^(\/|https:\/\/)[^\s]+$/.test(v), 'Enter a URL starting with https:// or /, or leave it empty.'),
  status: z.enum(['draft', 'published']),
});

export async function saveProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('products.manage');
  const parsed = productSchema.safeParse({ ...data(fd), id: fd.get('id') || undefined });
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const finalSlug = slug.safeParse(d.slug || slugify(d.name));
  if (!finalSlug.success) return { ok: false, message: 'Check the highlighted fields.', fields: { slug: finalSlug.error.issues[0].message } };
  if (d.compareAt !== null && d.compareAt <= d.price)
    return { ok: false, message: 'Check the highlighted fields.', fields: { compareAt: 'The original price must be higher than the price.' } };
  const categories = z.array(uuid).max(40).safeParse(fd.getAll('categories'));
  if (!categories.success) return { ok: false, message: 'Those categories are not valid.' };
  const featured = fd.get('featured') === 'on';

  let id = d.id;
  try {
    id = await transaction(async (client) => {
      const values = [d.name, finalSlug.data, d.description, d.brand, d.material, d.materialDetails, d.care, d.fit, d.price, d.compareAt, d.badge || null, d.videoUrl || null, d.status, featured];
      let productId: string;
      if (d.id) {
        const before = await queryOne<{ price_cents: number; status: string }>('select price_cents, status from products where id = $1 for update', [d.id], client);
        if (!before) throw new Error('missing');
        await query(
          `update products set name=$1, slug=$2, description=$3, brand=$4, material=$5, material_details=$6, care=$7, fit=$8, price_cents=$9,
                  compare_at_cents=$10, badge=$11, video_url=$12, status=$13, is_featured=$14, updated_at=now(),
                  published_at = case when $13 = 'published' then coalesce(published_at, now()) else published_at end
            where id = $15`,
          [...values, d.id],
          client,
        );
        productId = d.id;
        await audit({ actor, action: 'product.updated', entityType: 'product', entityId: productId, details: { name: d.name, priceBefore: before.price_cents, priceAfter: d.price, statusBefore: before.status, statusAfter: d.status } }, client);
      } else {
        const row = await queryOne<{ id: string }>(
          `insert into products (name, slug, description, brand, material, material_details, care, fit, price_cents, compare_at_cents, badge, video_url, status, is_featured, published_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, case when $13 = 'published' then now() end) returning id`,
          values,
          client,
        );
        productId = row!.id;
        await audit({ actor, action: 'product.created', entityType: 'product', entityId: productId, details: { name: d.name } }, client);
      }
      await query('delete from product_categories where product_id = $1', [productId], client);
      if (categories.data.length)
        await query(
          `insert into product_categories (product_id, category_id)
           select $1, id from categories where id = any($2::uuid[])`,
          [productId, categories.data],
          client,
        );
      return productId;
    });
  } catch (err) {
    if (isUnique(err)) return { ok: false, message: 'Check the highlighted fields.', fields: { slug: 'Another product already uses this URL slug.' } };
    if ((err as Error).message === 'missing') return { ok: false, message: 'That product no longer exists.' };
    throw err;
  }
  revalidatePath('/', 'layout');
  if (!d.id) redirect(`/admin/products/${id}?created=1`);
  return { ok: true, message: 'Product saved.' };
}

export async function setProductStatusAction(fd: FormData): Promise<void> {
  const actor = await assertPermission('products.manage');
  const p = z.object({ id: uuid, status: z.enum(['draft', 'published']) }).safeParse(data(fd));
  if (!p.success) return;
  await query(
    `update products set status = $2, updated_at = now(), published_at = case when $2 = 'published' then coalesce(published_at, now()) else published_at end where id = $1`,
    [p.data.id, p.data.status],
  );
  await audit({ actor, action: p.data.status === 'published' ? 'product.published' : 'product.unpublished', entityType: 'product', entityId: p.data.id });
  revalidatePath('/', 'layout');
}

export async function deleteProductAction(fd: FormData): Promise<void> {
  const actor = await assertPermission('products.manage');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return;
  const images = await query<{ url: string }>('select url from product_images where product_id = $1', [id.data]);
  const row = await queryOne<{ name: string }>('delete from products where id = $1 returning name', [id.data]);
  if (!row) return;
  await Promise.all(images.map((i) => removeUpload(i.url)));
  await audit({ actor, action: 'product.deleted', entityType: 'product', entityId: id.data, details: { name: row.name } });
  revalidatePath('/', 'layout');
  redirect('/admin/products?deleted=1');
}

// ---- Variants & inventory ---------------------------------------------------

export async function addVariantsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('products.manage');
  const parsed = z
    .object({
      productId: uuid,
      color: text(40).min(1, 'Enter a colour name.'),
      colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour.'),
      sizes: z
        .string()
        .transform((v) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))])
        .refine((v) => v.length >= 1 && v.length <= 20 && v.every((s) => s.length <= 16), 'Enter 1 to 20 sizes separated by commas, like S, M, L.'),
      quantity: z.coerce.number().int('Whole numbers only.').min(0).max(100000),
    })
    .safeParse(data(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const product = await queryOne<{ slug: string }>('select slug from products where id = $1', [d.productId]);
  if (!product) return { ok: false, message: 'That product no longer exists.' };
  const prefix = product.slug.split('-').map((w) => w[0]).join('').toUpperCase().slice(0, 5);
  const added = await transaction(async (client) => {
    const base = await queryOne<{ n: number }>('select coalesce(max(sort_order), -1) + 1 as n from product_variants where product_id = $1', [d.productId], client);
    let n = 0;
    for (const size of d.sizes) {
      const exists = await queryOne('select 1 from product_variants where product_id = $1 and size = $2 and color = $3', [d.productId, size, d.color], client);
      if (exists) continue;
      const sku = `${prefix}-${d.color.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()}-${size.replace(/\s+/g, '').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
      const v = await queryOne<{ id: string }>(
        'insert into product_variants (product_id, sku, size, color, color_hex, sort_order) values ($1,$2,$3,$4,$5,$6) returning id',
        [d.productId, sku, size, d.color, d.colorHex, (base?.n ?? 0) + n],
        client,
      );
      await query('insert into inventory (variant_id, quantity) values ($1, $2)', [v!.id, d.quantity], client);
      n++;
    }
    await audit({ actor, action: 'variant.created', entityType: 'product', entityId: d.productId, details: { color: d.color, sizes: d.sizes, quantityEach: d.quantity, added: n } }, client);
    return n;
  });
  revalidatePath('/', 'layout');
  return added
    ? { ok: true, message: `Added ${added} ${added === 1 ? 'variant' : 'variants'} in ${d.color}.` }
    : { ok: false, message: 'Those sizes already exist in that colour.' };
}

export async function updateVariantAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('products.manage');
  const parsed = z
    .object({
      id: uuid,
      sku: text(60).min(1, 'Enter a SKU.').optional(),
      quantity: z.coerce.number().int('Whole numbers only.').min(0, 'Stock cannot be negative.').max(100000),
      threshold: z.coerce.number().int().min(0).max(100000).optional(),
    })
    .safeParse(data(fd));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the values.' };
  const d = parsed.data;
  const active = fd.has('activeField') ? fd.get('active') === 'on' : undefined;
  try {
    const result = await transaction(async (client) => {
      const before = await queryOne<{ quantity: number; product_id: string; sku: string }>(
        `select coalesce(i.quantity, 0) as quantity, v.product_id, v.sku from product_variants v
           left join inventory i on i.variant_id = v.id where v.id = $1 for update of v`,
        [d.id],
        client,
      );
      if (!before) return null;
      await query(
        `insert into inventory (variant_id, quantity, low_stock_threshold) values ($1, $2, coalesce($3, 5))
         on conflict (variant_id) do update set quantity = $2, low_stock_threshold = coalesce($3, inventory.low_stock_threshold), updated_at = now()`,
        [d.id, d.quantity, d.threshold ?? null],
        client,
      );
      if (d.sku !== undefined || active !== undefined)
        await query('update product_variants set sku = coalesce($2, sku), is_active = coalesce($3, is_active) where id = $1', [d.id, d.sku ?? null, active ?? null], client);
      if (before.quantity !== d.quantity)
        await audit({ actor, action: 'inventory.adjusted', entityType: 'product', entityId: before.product_id, details: { sku: before.sku, before: before.quantity, after: d.quantity } }, client);
      return before;
    });
    if (!result) return { ok: false, message: 'That variant no longer exists.' };
  } catch (err) {
    if (isUnique(err)) return { ok: false, message: 'Another variant already uses that SKU.' };
    throw err;
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved' };
}

export async function deleteVariantAction(fd: FormData): Promise<void> {
  const actor = await assertPermission('products.manage');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return;
  const row = await queryOne<{ product_id: string; sku: string }>('delete from product_variants where id = $1 returning product_id, sku', [id.data]);
  if (row) await audit({ actor, action: 'variant.deleted', entityType: 'product', entityId: row.product_id, details: { sku: row.sku } });
  revalidatePath('/', 'layout');
}

// ---- Images -----------------------------------------------------------------

const UPLOAD_DIR = join(process.cwd(), 'storage', 'uploads');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

async function removeUpload(url: string) {
  const m = url.match(/^\/media\/([a-f0-9]{32}\.webp)$/);
  if (m) await unlink(join(UPLOAD_DIR, m[1])).catch(() => {});
}

export async function uploadImageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('products.manage');
  const parsed = z.object({ productId: uuid, alt: text(160), color: text(40) }).safeParse(data(fd));
  if (!parsed.success) return fail(parsed.error);
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose an image file to upload.' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: 'That file is larger than 5 MB.' };
  const product = await queryOne('select 1 from products where id = $1', [parsed.data.productId]);
  if (!product) return { ok: false, message: 'That product no longer exists.' };

  // The real format is read from the bytes (never the filename or MIME header), and the
  // image is re-encoded, which strips metadata and anything that is not pixel data.
  let output: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 });
    const meta = await image.metadata();
    if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) return { ok: false, message: 'Upload a JPEG, PNG or WebP image.' };
    output = await image.rotate().resize({ width: 1800, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  } catch {
    return { ok: false, message: 'That file is not a readable image.' };
  }
  const name = `${randomBytes(16).toString('hex')}.webp`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), output);
  const sort = await queryOne<{ n: number }>('select coalesce(max(sort_order), -1) + 1 as n from product_images where product_id = $1', [parsed.data.productId]);
  await query('insert into product_images (product_id, url, alt, color, sort_order) values ($1, $2, $3, $4, $5)', [
    parsed.data.productId, `/media/${name}`, parsed.data.alt, parsed.data.color || null, sort?.n ?? 0,
  ]);
  await audit({ actor, action: 'image.uploaded', entityType: 'product', entityId: parsed.data.productId, details: { file: name } });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Image uploaded.' };
}

export async function updateImageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await assertPermission('products.manage');
  const parsed = z.object({ id: uuid, alt: text(160), color: text(40), sortOrder: z.coerce.number().int().min(0).max(999) }).safeParse(data(fd));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the values.' };
  await query('update product_images set alt = $2, color = $3, sort_order = $4 where id = $1', [parsed.data.id, parsed.data.alt, parsed.data.color || null, parsed.data.sortOrder]);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved' };
}

export async function deleteImageAction(fd: FormData): Promise<void> {
  const actor = await assertPermission('products.manage');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return;
  const row = await queryOne<{ product_id: string; url: string }>('delete from product_images where id = $1 returning product_id, url', [id.data]);
  if (!row) return;
  await removeUpload(row.url);
  await audit({ actor, action: 'image.deleted', entityType: 'product', entityId: row.product_id, details: { url: row.url } });
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('products.manage');
  const parsed = z
    .object({
      id: uuid.optional(),
      name: text(80).min(2, 'Enter a name.'),
      slug: z.string().trim().max(80).optional(),
      kind: z.enum(['department', 'type', 'collection']),
      description: text(400),
      imageUrl: z.string().trim().max(400).refine((v) => v === '' || /^(\/|https:\/\/)/.test(v), 'Start with / or https://, or leave it empty.'),
      sortOrder: z.coerce.number().int().min(0).max(999),
    })
    .safeParse({ ...data(fd), id: fd.get('id') || undefined });
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const s = slug.safeParse(d.slug || slugify(d.name));
  if (!s.success) return { ok: false, message: 'Check the highlighted fields.', fields: { slug: s.error.issues[0].message } };
  const values = [d.name, s.data, d.kind, d.description, d.imageUrl || null, d.sortOrder, fd.get('active') === 'on', fd.get('featured') === 'on'];
  try {
    if (d.id) {
      await query('update categories set name=$1, slug=$2, kind=$3, description=$4, image_url=$5, sort_order=$6, is_active=$7, is_featured=$8 where id=$9', [...values, d.id]);
      await audit({ actor, action: 'category.updated', entityType: 'category', entityId: d.id, details: { name: d.name } });
    } else {
      const row = await queryOne<{ id: string }>(
        'insert into categories (name, slug, kind, description, image_url, sort_order, is_active, is_featured) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id',
        values,
      );
      await audit({ actor, action: 'category.created', entityType: 'category', entityId: row!.id, details: { name: d.name } });
    }
  } catch (err) {
    if (isUnique(err)) return { ok: false, message: 'Check the highlighted fields.', fields: { slug: 'Another category already uses this slug.' } };
    throw err;
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: d.id ? 'Category saved.' : 'Category added.' };
}

export async function deleteCategoryAction(fd: FormData): Promise<void> {
  const actor = await assertPermission('products.manage');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return;
  const row = await queryOne<{ name: string }>('delete from categories where id = $1 returning name', [id.data]);
  if (row) await audit({ actor, action: 'category.deleted', entityType: 'category', entityId: id.data, details: { name: row.name } });
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;

export async function updateOrderStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('orders.manage');
  const parsed = z.object({ id: uuid, status: z.enum(FLOW) }).safeParse(data(fd));
  if (!parsed.success) return { ok: false, message: 'Choose a status.' };
  const { id, status } = parsed.data;
  return transaction(async (client) => {
    const order = await queryOne<{ status: string; payment_status: string }>('select status, payment_status from orders where id = $1 for update', [id], client);
    if (!order) return { ok: false, message: 'Order not found.' };
    if (order.status === 'cancelled') return { ok: false, message: 'A cancelled order cannot be reopened.' };
    if (order.status === status) return { ok: true, message: 'No change.' };
    const paid = order.payment_status === 'paid' || order.payment_status === 'partially_refunded';
    if (FLOW.indexOf(status) >= FLOW.indexOf('confirmed') && !paid)
      return { ok: false, message: 'This order has not been paid, so it cannot move forward yet.' };
    if (status === 'pending') return { ok: false, message: 'A paid order cannot go back to awaiting payment.' };
    await query('update orders set status = $2, updated_at = now() where id = $1', [id, status], client);
    await audit({ actor, action: 'order.status_changed', entityType: 'order', entityId: id, details: { before: order.status, after: status } }, client);
    revalidatePath('/admin', 'layout');
    return { ok: true, message: 'Status updated.' };
  });
}

export async function setTrackingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('orders.manage');
  const parsed = z.object({ id: uuid, carrier: text(40).min(1, 'Enter the carrier.'), trackingNumber: text(60).min(3, 'Enter the tracking number.') }).safeParse(data(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const row = await queryOne('update orders set tracking_carrier = $2, tracking_number = $3, updated_at = now() where id = $1 returning id', [d.id, d.carrier, d.trackingNumber]);
  if (!row) return { ok: false, message: 'Order not found.' };
  await audit({ actor, action: 'order.tracking_set', entityType: 'order', entityId: d.id, details: { carrier: d.carrier, trackingNumber: d.trackingNumber } });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Tracking saved.' };
}

export async function cancelOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('orders.manage');
  const parsed = z.object({ id: uuid, reason: text(200) }).safeParse(data(fd));
  if (!parsed.success) return { ok: false, message: 'Order not found.' };
  try {
    await cancelOrder(parsed.data.id, actor, parsed.data.reason);
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Order cancelled and stock returned. Refund the payment separately if one was taken.' };
}

export async function refundOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('refunds.process');
  const parsed = z.object({ id: uuid, amount: money }).safeParse(data(fd));
  if (!parsed.success) return fail(parsed.error);
  try {
    await refundOrder(parsed.data.id, parsed.data.amount, actor);
  } catch (err) {
    if (err instanceof RefundError) return { ok: false, message: err.message };
    console.error('[admin] refund failed', err);
    return { ok: false, message: 'The payment provider rejected the refund. Nothing was changed.' };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Refund recorded.' };
}

/** Records an offline payment (e.g. bank transfer). Only available where demo payments are allowed. */
export async function markPaidAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('orders.manage');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return { ok: false, message: 'Order not found.' };
  if (!demoPaymentsAllowed()) return { ok: false, message: 'Manual payments are disabled in production. Payments are confirmed by the payment provider.' };
  const order = await queryOne<{ total_cents: number; number: string }>('select total_cents, number from orders where id = $1', [id.data]);
  if (!order) return { ok: false, message: 'Order not found.' };
  try {
    await markOrderPaid(id.data, { provider: 'demo', providerRef: `manual_${order.number}`, amountCents: order.total_cents }, actor);
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Payment recorded.' };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function setCustomerStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('customers.manage');
  const parsed = z.object({ id: uuid, status: z.enum(['active', 'suspended']) }).safeParse(data(fd));
  if (!parsed.success) return { ok: false, message: 'Customer not found.' };
  if (parsed.data.id === actor.id) return { ok: false, message: 'You cannot suspend your own account.' };
  const target = await queryOne<{ permissions: string[] }>('select r.permissions from users u join roles r on r.id = u.role_id where u.id = $1', [parsed.data.id]);
  if (!target) return { ok: false, message: 'Customer not found.' };
  if (target.permissions.length && !actor.permissions.includes('roles.manage'))
    return { ok: false, message: 'Only administrators can change a staff account.' };
  await query('update users set status = $2 where id = $1', [parsed.data.id, parsed.data.status]);
  if (parsed.data.status === 'suspended') await query('delete from sessions where user_id = $1', [parsed.data.id]);
  await audit({ actor, action: parsed.data.status === 'suspended' ? 'customer.suspended' : 'customer.reactivated', entityType: 'user', entityId: parsed.data.id });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: parsed.data.status === 'suspended' ? 'Account suspended and signed out everywhere.' : 'Account reactivated.' };
}

export async function setCustomerRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('roles.manage');
  const parsed = z.object({ id: uuid, roleId: z.coerce.number().int() }).safeParse(data(fd));
  if (!parsed.success) return { ok: false, message: 'Choose a role.' };
  if (parsed.data.id === actor.id) return { ok: false, message: 'You cannot change your own role.' };
  const role = await queryOne<{ key: string }>('select key from roles where id = $1', [parsed.data.roleId]);
  if (!role) return { ok: false, message: 'That role does not exist.' };
  const row = await queryOne('update users set role_id = $2 where id = $1 returning id', [parsed.data.id, parsed.data.roleId]);
  if (!row) return { ok: false, message: 'Customer not found.' };
  await query('delete from sessions where user_id = $1', [parsed.data.id]);
  await audit({ actor, action: 'user.role_changed', entityType: 'user', entityId: parsed.data.id, details: { role: role.key } });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Role changed. The user must sign in again.' };
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

const optionalDate = z.string().trim().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Choose a date, or leave it empty.').transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

export async function saveCouponAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('promotions.manage');
  const parsed = z
    .object({
      id: uuid.optional(),
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, 'Use 3 to 30 letters, numbers, hyphens or underscores.'),
      description: text(160),
      campaign: text(60),
      kind: z.enum(['percent', 'fixed']),
      value: z.string().trim().regex(/^\d{1,6}(\.\d{1,2})?$/, 'Enter a number.'),
      minSubtotal: optionalMoney.transform((v) => v ?? 0),
      startsAt: optionalDate,
      expiresAt: optionalDate,
      usageLimit: z.string().trim().refine((v) => v === '' || /^[1-9]\d{0,6}$/.test(v), 'Use a whole number of 1 or more, or leave it empty.').transform((v) => (v === '' ? null : Number(v))),
    })
    .safeParse({ ...data(fd), id: fd.get('id') || undefined });
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const value = d.kind === 'percent' ? Math.round(Number(d.value)) : Math.round(Number(d.value) * 100);
  if (value <= 0) return { ok: false, message: 'Check the highlighted fields.', fields: { value: 'Enter a value above zero.' } };
  if (d.kind === 'percent' && value > 100) return { ok: false, message: 'Check the highlighted fields.', fields: { value: 'A percentage cannot be more than 100.' } };
  if (d.startsAt && d.expiresAt && d.expiresAt <= d.startsAt) return { ok: false, message: 'Check the highlighted fields.', fields: { expiresAt: 'The end date must be after the start date.' } };
  const values = [d.code, d.description, d.campaign, d.kind, value, d.minSubtotal, d.startsAt, d.expiresAt, d.usageLimit, fd.get('active') === 'on'];
  try {
    if (d.id) {
      await query('update coupons set code=$1, description=$2, campaign=$3, kind=$4, value=$5, min_subtotal_cents=$6, starts_at=$7, expires_at=$8, usage_limit=$9, is_active=$10 where id=$11', [...values, d.id]);
      await audit({ actor, action: 'coupon.updated', entityType: 'coupon', entityId: d.id, details: { code: d.code, kind: d.kind, value } });
    } else {
      const row = await queryOne<{ id: string }>(
        'insert into coupons (code, description, campaign, kind, value, min_subtotal_cents, starts_at, expires_at, usage_limit, is_active) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id',
        values,
      );
      await audit({ actor, action: 'coupon.created', entityType: 'coupon', entityId: row!.id, details: { code: d.code, kind: d.kind, value } });
    }
  } catch (err) {
    if (isUnique(err)) return { ok: false, message: 'Check the highlighted fields.', fields: { code: 'That code already exists.' } };
    throw err;
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: d.id ? 'Coupon saved.' : `Coupon ${d.code} created.` };
}

export async function deleteCouponAction(fd: FormData): Promise<void> {
  const actor = await assertPermission('promotions.manage');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return;
  const row = await queryOne<{ code: string }>('delete from coupons where id = $1 returning code::text as code', [id.data]);
  if (row) await audit({ actor, action: 'coupon.deleted', entityType: 'coupon', entityId: id.data, details: { code: row.code } });
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------------------
// Settings, shipping, roles
// ---------------------------------------------------------------------------

const url = z.string().trim().max(300).refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), 'Enter a full URL starting with https://, or leave it empty.');

const settingsSchemas = {
  brand: z.object({ name: text(40).min(1, 'Enter the store name.'), tagline: text(80), description: text(400), logoUrl: z.string().trim().max(300).refine((v) => v === '' || /^(\/|https:\/\/)/.test(v), 'Start with / or https://, or leave it empty.').transform((v) => v || null) }),
  locale: z.object({ currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SEK']), locale: z.enum(['en-US', 'en-GB', 'de-DE', 'fr-FR', 'sv-SE']) }),
  announcement: z.object({
    enabled: z.string().optional().transform((v) => v === 'on'),
    messages: z.string().transform((v) => v.split('\n').map((s) => s.trim()).filter(Boolean)).refine((v) => v.length <= 6 && v.every((m) => m.length <= 120), 'Use up to 6 messages of 120 characters or fewer, one per line.'),
  }),
  tax: z.object({ ratePercent: z.coerce.number().min(0, 'Use 0 or more.').max(40, 'Use 40 or less.'), label: text(40).min(1, 'Enter a label.') }),
  payments: z.object({ stripe: z.string().optional().transform((v) => v === 'on'), demo: z.string().optional().transform((v) => v === 'on') }),
  contact: z.object({ email: z.string().trim().email('Enter a valid email.'), phone: text(40), address: text(200), hours: text(120) }),
  social: z.object({ instagram: url, tiktok: url, pinterest: url }),
  theme: z.object({ defaultTheme: z.enum(['light', 'dark']) }),
} as const;

export async function saveSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('settings.manage');
  const section = String(fd.get('section')) as keyof typeof settingsSchemas | 'shipping';
  if (section === 'shipping') {
    const countries = fd.getAll('countries').map(String).filter((c) => c in COUNTRY_NAMES);
    if (!countries.length) return { ok: false, message: 'Choose at least one country to ship to.' };
    await saveSetting('shipping', { countries });
  } else {
    const schema = settingsSchemas[section];
    if (!schema) return { ok: false, message: 'Unknown settings section.' };
    const parsed = schema.safeParse(data(fd));
    if (!parsed.success) return fail(parsed.error);
    await saveSetting(section, parsed.data as StoreSettings[typeof section]);
  }
  await audit({ actor, action: 'settings.updated', entityType: 'settings', entityId: section });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Settings saved.' };
}

export async function saveShippingMethodAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('settings.manage');
  const parsed = z
    .object({
      id: uuid.optional(),
      name: text(40).min(2, 'Enter a name.'),
      description: text(160),
      price: money,
      freeOver: optionalMoney,
      minDays: z.coerce.number().int().min(0).max(60),
      maxDays: z.coerce.number().int().min(0).max(90),
      sortOrder: z.coerce.number().int().min(0).max(99),
    })
    .safeParse({ ...data(fd), id: fd.get('id') || undefined });
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  if (d.maxDays < d.minDays) return { ok: false, message: 'Check the highlighted fields.', fields: { maxDays: 'Must be the same as or more than the minimum.' } };
  const values = [d.name, d.description, d.price, d.freeOver, d.minDays, d.maxDays, d.sortOrder, fd.get('active') === 'on'];
  if (d.id) {
    await query('update shipping_methods set name=$1, description=$2, price_cents=$3, free_over_cents=$4, min_days=$5, max_days=$6, sort_order=$7, is_active=$8 where id=$9', [...values, d.id]);
  } else {
    await query('insert into shipping_methods (name, description, price_cents, free_over_cents, min_days, max_days, sort_order, is_active, code) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
      ...values, `${slugify(d.name)}-${randomBytes(2).toString('hex')}`,
    ]);
  }
  await audit({ actor, action: d.id ? 'shipping.updated' : 'shipping.created', entityType: 'shipping_method', entityId: d.id ?? null, details: { name: d.name, priceCents: d.price } });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Delivery method saved.' };
}

export async function deleteShippingMethodAction(fd: FormData): Promise<void> {
  const actor = await assertPermission('settings.manage');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return;
  const row = await queryOne<{ name: string }>('delete from shipping_methods where id = $1 returning name', [id.data]);
  if (row) await audit({ actor, action: 'shipping.deleted', entityType: 'shipping_method', entityId: id.data, details: { name: row.name } });
  revalidatePath('/', 'layout');
}

export async function saveRolePermissionsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertPermission('roles.manage');
  const roleId = z.coerce.number().int().safeParse(fd.get('roleId'));
  if (!roleId.success) return { ok: false, message: 'Role not found.' };
  const role = await queryOne<{ key: string }>('select key from roles where id = $1', [roleId.data]);
  if (!role) return { ok: false, message: 'Role not found.' };
  let permissions = fd.getAll('permissions').map(String).filter((p) => (PERMISSIONS as readonly string[]).includes(p));
  if (role.key === 'customer') permissions = [];
  // The administrator role can never lock itself out.
  if (role.key === 'admin') permissions = [...new Set([...permissions, 'dashboard.view', 'roles.manage', 'settings.manage'])];
  if (permissions.length && !permissions.includes('dashboard.view')) permissions.push('dashboard.view');
  await query('update roles set permissions = $2 where id = $1', [roleId.data, permissions]);
  await audit({ actor, action: 'role.permissions_changed', entityType: 'role', entityId: String(roleId.data), details: { role: role.key, permissions } });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Permissions saved.' };
}
