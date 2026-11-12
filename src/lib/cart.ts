import type pg from 'pg';
import { query, queryOne, transaction } from './db';
import { ensureVisitorHash, getCurrentUser, getVisitorHash } from './auth';
import { getSettings } from './settings';
import { computeTotals, couponProblem, type CouponRule, type Totals } from './totals';

export const MAX_QTY_PER_LINE = 10;

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  size: string;
  color: string;
  sku: string;
  unitPriceCents: number;
  compareAtCents: number | null;
  quantity: number;
  available: number;
  lineTotalCents: number;
  /** Other variants of the same product, so the customer can switch size/colour in the bag. */
  options: { id: string; size: string; color: string; qty: number }[];
};

export type CartView = {
  id: string | null;
  lines: CartLine[];
  itemCount: number;
  coupon: { code: string; description: string } | null;
  couponNotice: string | null;
  totals: Totals;
  /** Subtotal (after discount) at which the cheapest shipping method becomes free, if any. */
  freeShippingAtCents: number | null;
};

export class CartError extends Error {}

type CartRow = { id: string; coupon_id: string | null };

async function findCartRow(client?: pg.PoolClient): Promise<CartRow | null> {
  const user = await getCurrentUser();
  if (user) return queryOne<CartRow>('select id, coupon_id from carts where user_id = $1', [user.id], client);
  const visitor = await getVisitorHash();
  if (!visitor) return null;
  return queryOne<CartRow>('select id, coupon_id from carts where visitor_hash = $1', [visitor], client);
}

/** Server actions only: creates the cart (and visitor cookie) on first use. */
async function getOrCreateCartRow(): Promise<CartRow> {
  const existing = await findCartRow();
  if (existing) return existing;
  const user = await getCurrentUser();
  if (user) {
    const row = await queryOne<CartRow>(
      `insert into carts (user_id) values ($1)
       on conflict (user_id) do update set updated_at = now() returning id, coupon_id`,
      [user.id],
    );
    return row!;
  }
  const visitor = await ensureVisitorHash();
  const row = await queryOne<CartRow>(
    `insert into carts (visitor_hash) values ($1)
     on conflict (visitor_hash) do update set updated_at = now() returning id, coupon_id`,
    [visitor],
  );
  return row!;
}

type LineRow = {
  id: string;
  variant_id: string;
  product_id: string;
  slug: string;
  name: string;
  image: string | null;
  size: string;
  color: string;
  sku: string;
  price_cents: number;
  compare_at_cents: number | null;
  quantity: number;
  available: number;
  options: { id: string; size: string; color: string; qty: number }[];
};

export async function loadCartLines(cartId: string, client?: pg.PoolClient): Promise<CartLine[]> {
  const rows = await query<LineRow>(
    `select ci.id, ci.variant_id, p.id as product_id, p.slug, p.name, v.size, v.color, v.sku,
            p.price_cents, p.compare_at_cents, ci.quantity,
            coalesce(inv.quantity, 0) as available,
            coalesce(
              (select i.url from product_images i where i.product_id = p.id and i.color = v.color order by i.sort_order limit 1),
              (select i.url from product_images i where i.product_id = p.id order by i.sort_order limit 1)
            ) as image,
            (select coalesce(json_agg(json_build_object('id', o.id, 'size', o.size, 'color', o.color, 'qty', coalesce(oi.quantity, 0)) order by o.sort_order), '[]'::json)
               from product_variants o left join inventory oi on oi.variant_id = o.id
              where o.product_id = p.id and o.is_active) as options
       from cart_items ci
       join product_variants v on v.id = ci.variant_id and v.is_active
       join products p on p.id = v.product_id and p.status = 'published'
       left join inventory inv on inv.variant_id = v.id
      where ci.cart_id = $1
      order by ci.created_at`,
    [cartId],
    client,
  );
  return rows.map((r) => ({
    id: r.id,
    variantId: r.variant_id,
    productId: r.product_id,
    slug: r.slug,
    name: r.name,
    image: r.image,
    size: r.size,
    color: r.color,
    sku: r.sku,
    unitPriceCents: r.price_cents,
    compareAtCents: r.compare_at_cents,
    quantity: r.quantity,
    available: r.available,
    lineTotalCents: r.price_cents * r.quantity,
    options: r.options,
  }));
}

export async function loadCoupon(id: string | null, client?: pg.PoolClient): Promise<CouponRule | null> {
  if (!id) return null;
  return queryOne<CouponRule>(
    `select id, code::text as code, description, kind, value, min_subtotal_cents, starts_at, expires_at,
            usage_limit, used_count, is_active from coupons where id = $1`,
    [id],
    client,
  );
}

const EMPTY_TOTALS: Totals = { subtotalCents: 0, discountCents: 0, shippingCents: 0, taxCents: 0, totalCents: 0 };

/** The current visitor's bag with server-computed totals (shipping is added at checkout). */
export async function getCartView(): Promise<CartView> {
  const cart = await findCartRow();
  const cheapest = await queryOne<{ free_over_cents: number | null }>(
    `select free_over_cents from shipping_methods where is_active order by price_cents limit 1`,
  );
  const freeShippingAtCents = cheapest?.free_over_cents ?? null;
  if (!cart)
    return { id: null, lines: [], itemCount: 0, coupon: null, couponNotice: null, totals: EMPTY_TOTALS, freeShippingAtCents };

  const [lines, couponRow, settings] = await Promise.all([loadCartLines(cart.id), loadCoupon(cart.coupon_id), getSettings()]);
  const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  let coupon = couponRow;
  let couponNotice: string | null = null;
  if (coupon) {
    const problem = couponProblem(coupon, subtotal);
    if (problem) {
      couponNotice = `${coupon.code} is not applied. ${problem}`;
      coupon = null;
    }
  }
  const totals = computeTotals({ lines, coupon, shipping: null, taxRatePercent: settings.tax.ratePercent });
  return {
    id: cart.id,
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    coupon: coupon ? { code: coupon.code, description: coupon.description } : null,
    couponNotice,
    totals,
    freeShippingAtCents,
  };
}

async function variantStock(variantId: string) {
  return queryOne<{ id: string; name: string; available: number }>(
    `select v.id, p.name, coalesce(inv.quantity, 0) as available
       from product_variants v
       join products p on p.id = v.product_id and p.status = 'published'
       left join inventory inv on inv.variant_id = v.id
      where v.id = $1 and v.is_active`,
    [variantId],
  );
}

export async function addToCart(variantId: string, quantity: number): Promise<void> {
  const variant = await variantStock(variantId);
  if (!variant) throw new CartError('That item is no longer available.');
  if (variant.available <= 0) throw new CartError(`${variant.name} is sold out in that size.`);
  const cart = await getOrCreateCartRow();
  const existing = await queryOne<{ quantity: number }>(
    'select quantity from cart_items where cart_id = $1 and variant_id = $2',
    [cart.id, variantId],
  );
  const wanted = (existing?.quantity ?? 0) + quantity;
  const cap = Math.min(MAX_QTY_PER_LINE, variant.available);
  if (wanted > cap) {
    throw new CartError(
      cap === variant.available
        ? `Only ${variant.available} left in that size. Your bag already has ${existing?.quantity ?? 0}.`
        : `You can add up to ${MAX_QTY_PER_LINE} of one item.`,
    );
  }
  await query(
    `insert into cart_items (cart_id, variant_id, quantity) values ($1, $2, $3)
     on conflict (cart_id, variant_id) do update set quantity = $3`,
    [cart.id, variantId, wanted],
  );
  await query('update carts set updated_at = now() where id = $1', [cart.id]);
}

export async function setLineQuantity(lineId: string, quantity: number): Promise<void> {
  const cart = await findCartRow();
  if (!cart) throw new CartError('Your bag is empty.');
  if (quantity <= 0) {
    await query('delete from cart_items where id = $1 and cart_id = $2', [lineId, cart.id]);
    return;
  }
  const line = await queryOne<{ variant_id: string }>('select variant_id from cart_items where id = $1 and cart_id = $2', [
    lineId,
    cart.id,
  ]);
  if (!line) throw new CartError('That item is no longer in your bag.');
  const variant = await variantStock(line.variant_id);
  if (!variant) throw new CartError('That item is no longer available.');
  const cap = Math.min(MAX_QTY_PER_LINE, variant.available);
  if (quantity > cap) throw new CartError(cap <= 0 ? `${variant.name} is sold out.` : `Only ${cap} available.`);
  await query('update cart_items set quantity = $1 where id = $2 and cart_id = $3', [quantity, lineId, cart.id]);
}

/** Switches a bag line to another size/colour of the same product. */
export async function changeLineVariant(lineId: string, newVariantId: string): Promise<void> {
  const cart = await findCartRow();
  if (!cart) throw new CartError('Your bag is empty.');
  await transaction(async (client) => {
    const line = await queryOne<{ variant_id: string; quantity: number; product_id: string }>(
      `select ci.variant_id, ci.quantity, v.product_id from cart_items ci
         join product_variants v on v.id = ci.variant_id where ci.id = $1 and ci.cart_id = $2 for update of ci`,
      [lineId, cart.id],
      client,
    );
    if (!line) throw new CartError('That item is no longer in your bag.');
    if (line.variant_id === newVariantId) return;
    const target = await queryOne<{ available: number }>(
      `select coalesce(inv.quantity, 0) as available from product_variants v
         left join inventory inv on inv.variant_id = v.id
        where v.id = $1 and v.product_id = $2 and v.is_active`,
      [newVariantId, line.product_id],
      client,
    );
    if (!target) throw new CartError('That option is not available.');
    const other = await queryOne<{ id: string; quantity: number }>(
      'select id, quantity from cart_items where cart_id = $1 and variant_id = $2',
      [cart.id, newVariantId],
      client,
    );
    const wanted = line.quantity + (other?.quantity ?? 0);
    if (target.available < 1) throw new CartError('That option is sold out.');
    const quantity = Math.min(wanted, target.available, MAX_QTY_PER_LINE);
    if (other) {
      await query('delete from cart_items where id = $1', [lineId], client);
      await query('update cart_items set quantity = $1 where id = $2', [quantity, other.id], client);
    } else {
      await query('update cart_items set variant_id = $1, quantity = $2 where id = $3', [newVariantId, quantity, lineId], client);
    }
  });
}

export async function applyCoupon(code: string): Promise<void> {
  const cart = await findCartRow();
  if (!cart) throw new CartError('Add something to your bag before applying a code.');
  const coupon = await queryOne<CouponRule>(
    `select id, code::text as code, description, kind, value, min_subtotal_cents, starts_at, expires_at,
            usage_limit, used_count, is_active from coupons where code = $1`,
    [code.trim()],
  );
  if (!coupon) throw new CartError('We could not find that code.');
  const lines = await loadCartLines(cart.id);
  const problem = couponProblem(
    coupon,
    lines.reduce((s, l) => s + l.lineTotalCents, 0),
  );
  if (problem) throw new CartError(problem);
  await query('update carts set coupon_id = $1, updated_at = now() where id = $2', [coupon.id, cart.id]);
}

export async function removeCoupon(): Promise<void> {
  const cart = await findCartRow();
  if (cart) await query('update carts set coupon_id = null where id = $1', [cart.id]);
}

/** After sign-in: fold the guest bag and wishlist into the account's. */
export async function mergeVisitorData(userId: string): Promise<void> {
  const visitor = await getVisitorHash();
  if (!visitor) return;
  await transaction(async (client) => {
    const guest = await queryOne<CartRow>('select id, coupon_id from carts where visitor_hash = $1 for update', [visitor], client);
    if (guest) {
      const mine = await queryOne<CartRow>(
        `insert into carts (user_id) values ($1)
         on conflict (user_id) do update set updated_at = now() returning id, coupon_id`,
        [userId],
        client,
      );
      await query(
        `insert into cart_items (cart_id, variant_id, quantity)
         select $1, variant_id, quantity from cart_items where cart_id = $2
         on conflict (cart_id, variant_id) do update
           set quantity = least(${MAX_QTY_PER_LINE}, cart_items.quantity + excluded.quantity)`,
        [mine!.id, guest.id],
        client,
      );
      if (!mine!.coupon_id && guest.coupon_id)
        await query('update carts set coupon_id = $1 where id = $2', [guest.coupon_id, mine!.id], client);
      await query('delete from carts where id = $1', [guest.id], client);
    }
    const guestList = await queryOne<{ id: string }>('select id from wishlists where visitor_hash = $1', [visitor], client);
    if (guestList) {
      const myList = await queryOne<{ id: string }>(
        `insert into wishlists (user_id) values ($1)
         on conflict (user_id) do update set user_id = excluded.user_id returning id`,
        [userId],
        client,
      );
      await query(
        `insert into wishlist_items (wishlist_id, product_id)
         select $1, product_id from wishlist_items where wishlist_id = $2 on conflict do nothing`,
        [myList!.id, guestList.id],
        client,
      );
      await query('delete from wishlists where id = $1', [guestList.id], client);
    }
  });
}

// ---- Wishlist --------------------------------------------------------------

async function findWishlistId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) return (await queryOne<{ id: string }>('select id from wishlists where user_id = $1', [user.id]))?.id ?? null;
  const visitor = await getVisitorHash();
  if (!visitor) return null;
  return (await queryOne<{ id: string }>('select id from wishlists where visitor_hash = $1', [visitor]))?.id ?? null;
}

export async function getWishlistIds(): Promise<string[]> {
  const id = await findWishlistId();
  if (!id) return [];
  const rows = await query<{ product_id: string }>(
    'select product_id from wishlist_items where wishlist_id = $1 order by created_at desc',
    [id],
  );
  return rows.map((r) => r.product_id);
}

/** Server actions only. Returns true when the product is now saved. */
export async function toggleWishlist(productId: string): Promise<boolean> {
  let id = await findWishlistId();
  if (!id) {
    const user = await getCurrentUser();
    const row = user
      ? await queryOne<{ id: string }>(
          `insert into wishlists (user_id) values ($1)
           on conflict (user_id) do update set user_id = excluded.user_id returning id`,
          [user.id],
        )
      : await queryOne<{ id: string }>(
          `insert into wishlists (visitor_hash) values ($1)
           on conflict (visitor_hash) do update set visitor_hash = excluded.visitor_hash returning id`,
          [await ensureVisitorHash()],
        );
    id = row!.id;
  }
  const removed = await query('delete from wishlist_items where wishlist_id = $1 and product_id = $2 returning 1', [id, productId]);
  if (removed.length) return false;
  const exists = await queryOne(`select 1 from products where id = $1 and status = 'published'`, [productId]);
  if (!exists) throw new CartError('That product is no longer available.');
  await query('insert into wishlist_items (wishlist_id, product_id) values ($1, $2) on conflict do nothing', [id, productId]);
  return true;
}
