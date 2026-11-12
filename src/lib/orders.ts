import type pg from 'pg';
import { randomInt } from 'node:crypto';
import { query, queryOne, transaction } from './db';
import { audit } from './audit';
import { hashToken, newToken } from './password';
import { loadCartLines, loadCoupon } from './cart';
import { computeTotals, couponProblem } from './totals';
import { getSettings } from './settings';
import type { SessionUser } from './auth';

export class OrderError extends Error {}

export type CheckoutInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  shippingMethodId: string;
};

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';

export type Order = {
  id: string;
  number: string;
  userId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipRegion: string | null;
  shipPostalCode: string;
  shipCountry: string;
  shippingMethodName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  couponCode: string | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

const ORDER_COLUMNS = `id, number, user_id, email::text as email, first_name, last_name, phone, ship_line1, ship_line2,
  ship_city, ship_region, ship_postal_code, ship_country, shipping_method_name, status, payment_status, currency,
  subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, coupon_code, tracking_carrier,
  tracking_number, created_at, updated_at`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOrder(r: any): Order {
  return {
    id: r.id,
    number: r.number,
    userId: r.user_id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    shipLine1: r.ship_line1,
    shipLine2: r.ship_line2,
    shipCity: r.ship_city,
    shipRegion: r.ship_region,
    shipPostalCode: r.ship_postal_code,
    shipCountry: r.ship_country,
    shippingMethodName: r.shipping_method_name,
    status: r.status,
    paymentStatus: r.payment_status,
    currency: r.currency,
    subtotalCents: r.subtotal_cents,
    discountCents: r.discount_cents,
    shippingCents: r.shipping_cents,
    taxCents: r.tax_cents,
    totalCents: r.total_cents,
    couponCode: r.coupon_code,
    trackingCarrier: r.tracking_carrier,
    trackingNumber: r.tracking_number,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const NUMBER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function newOrderNumber(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += NUMBER_ALPHABET[randomInt(NUMBER_ALPHABET.length)];
  return `HD-${s}`;
}

export type ShippingMethod = {
  id: string;
  code: string;
  name: string;
  description: string;
  price_cents: number;
  free_over_cents: number | null;
  min_days: number;
  max_days: number;
};

export async function listShippingMethods(): Promise<ShippingMethod[]> {
  return query<ShippingMethod>(
    `select id, code, name, description, price_cents, free_over_cents, min_days, max_days
       from shipping_methods where is_active order by sort_order, price_cents`,
  );
}

/**
 * Turns a cart into an order inside one transaction:
 * re-reads prices from the database, re-validates the coupon, and decrements
 * stock with a guarded UPDATE so two shoppers can never buy the same last unit.
 * The order starts as pending/unpaid; stock is held until payment or cancellation.
 */
export async function placeOrder(cartId: string, input: CheckoutInput, user: SessionUser | null) {
  const settings = await getSettings();
  if (!settings.shipping.countries.includes(input.country)) throw new OrderError('We do not ship to that country yet.');

  const accessKey = newToken(24);
  const result = await transaction(async (client) => {
    const cart = await queryOne<{ id: string; coupon_id: string | null }>(
      'select id, coupon_id from carts where id = $1 for update',
      [cartId],
      client,
    );
    if (!cart) throw new OrderError('Your bag is empty.');
    const lines = await loadCartLines(cart.id, client);
    if (!lines.length) throw new OrderError('Your bag is empty.');

    const method = await queryOne<ShippingMethod>(
      `select id, code, name, description, price_cents, free_over_cents, min_days, max_days
         from shipping_methods where id = $1 and is_active`,
      [input.shippingMethodId],
      client,
    );
    if (!method) throw new OrderError('Choose a delivery method.');

    // Guarded decrement, in a stable order to avoid deadlocks between concurrent checkouts.
    for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
      const updated = await client.query(
        `update inventory set quantity = quantity - $1, updated_at = now()
          where variant_id = $2 and quantity >= $1`,
        [line.quantity, line.variantId],
      );
      if (updated.rowCount !== 1)
        throw new OrderError(`${line.name} (${line.color}, ${line.size}) just sold out or has fewer left than you asked for. Update your bag and try again.`);
    }

    let coupon = await loadCoupon(cart.coupon_id, client);
    const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
    if (coupon) {
      if (couponProblem(coupon, subtotal)) coupon = null;
      else {
        const claimed = await client.query(
          `update coupons set used_count = used_count + 1
            where id = $1 and (usage_limit is null or used_count < usage_limit)`,
          [coupon.id],
        );
        if (claimed.rowCount !== 1) coupon = null;
      }
    }

    const totals = computeTotals({ lines, coupon, shipping: method, taxRatePercent: settings.tax.ratePercent });

    let order: { id: string; number: string } | null = null;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      await client.query('savepoint order_number');
      try {
        order = await queryOne<{ id: string; number: string }>(
          `insert into orders (number, access_key_hash, user_id, email, first_name, last_name, phone,
                               ship_line1, ship_line2, ship_city, ship_region, ship_postal_code, ship_country,
                               shipping_method_id, shipping_method_name, currency,
                               subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
                               coupon_id, coupon_code)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
           returning id, number`,
          [
            newOrderNumber(),
            hashToken(accessKey),
            user?.id ?? null,
            input.email,
            input.firstName,
            input.lastName,
            input.phone || null,
            input.line1,
            input.line2 || null,
            input.city,
            input.region || null,
            input.postalCode,
            input.country,
            method.id,
            method.name,
            settings.locale.currency,
            totals.subtotalCents,
            totals.discountCents,
            totals.shippingCents,
            totals.taxCents,
            totals.totalCents,
            coupon?.id ?? null,
            coupon?.code ?? null,
          ],
          client,
        );
      } catch (err) {
        if ((err as { code?: string }).code !== '23505') throw err;
        await client.query('rollback to savepoint order_number');
      }
    }
    if (!order) throw new OrderError('We could not create your order. Please try again.');

    for (const line of lines) {
      await query(
        `insert into order_items (order_id, product_id, variant_id, product_name, product_slug, sku, size, color,
                                  image_url, unit_price_cents, quantity, line_total_cents)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          order.id,
          line.productId,
          line.variantId,
          line.name,
          line.slug,
          line.sku,
          line.size,
          line.color,
          line.image,
          line.unitPriceCents,
          line.quantity,
          line.lineTotalCents,
        ],
        client,
      );
    }

    await query('delete from cart_items where cart_id = $1', [cart.id], client);
    await query('update carts set coupon_id = null, updated_at = now() where id = $1', [cart.id], client);
    await audit(
      {
        actor: user ? { id: user.id, email: user.email } : null,
        action: 'order.placed',
        entityType: 'order',
        entityId: order.id,
        details: { number: order.number, totalCents: totals.totalCents, items: lines.length },
      },
      client,
    );
    return { id: order.id, number: order.number, totalCents: totals.totalCents, currency: settings.locale.currency };
  });
  return { ...result, accessKey };
}

/** Idempotent: records a successful payment and confirms the order. */
export async function markOrderPaid(
  orderId: string,
  payment: { provider: 'stripe' | 'demo'; providerRef: string | null; amountCents: number },
  actor: { id: string; email: string } | null = null,
): Promise<void> {
  await transaction(async (client) => {
    const order = await queryOne<{ id: string; payment_status: string; status: string; currency: string; total_cents: number }>(
      'select id, payment_status, status, currency, total_cents from orders where id = $1 for update',
      [orderId],
      client,
    );
    if (!order) throw new OrderError('Order not found.');
    if (order.payment_status === 'paid') return;
    if (order.status === 'cancelled') throw new OrderError('This order was cancelled.');
    if (payment.amountCents !== order.total_cents) throw new OrderError('Payment amount does not match the order total.');

    // A pending row exists for redirect-based providers; replace it with the captured payment.
    await query(`delete from payments where order_id = $1 and status = 'pending'`, [order.id], client);
    await query(
      `insert into payments (order_id, provider, provider_ref, amount_cents, currency, status)
       values ($1, $2, $3, $4, $5, 'succeeded')`,
      [order.id, payment.provider, payment.providerRef, payment.amountCents, order.currency],
      client,
    );
    await query(
      `update orders set payment_status = 'paid', status = 'confirmed', updated_at = now() where id = $1`,
      [order.id],
      client,
    );
    await query(
      `update products p set sold_count = p.sold_count + s.qty, popularity = p.popularity + s.qty
         from (select product_id, sum(quantity) as qty from order_items where order_id = $1 and product_id is not null group by product_id) s
        where p.id = s.product_id`,
      [order.id],
      client,
    );
    await audit(
      { actor, action: 'order.paid', entityType: 'order', entityId: order.id, details: { provider: payment.provider } },
      client,
    );
  });
}

/** Returns held stock to inventory exactly once per order. */
async function releaseStock(orderId: string, client: pg.PoolClient): Promise<void> {
  const flagged = await client.query(
    'update orders set stock_released = true where id = $1 and stock_released = false',
    [orderId],
  );
  if (flagged.rowCount !== 1) return;
  await query(
    `update inventory inv set quantity = inv.quantity + oi.quantity, updated_at = now()
       from order_items oi where oi.order_id = $1 and oi.variant_id = inv.variant_id`,
    [orderId],
    client,
  );
}

export async function cancelOrder(
  orderId: string,
  actor: { id: string; email: string } | null,
  reason = '',
): Promise<void> {
  await transaction(async (client) => {
    const order = await queryOne<{ id: string; status: string; coupon_id: string | null }>(
      'select id, status, coupon_id from orders where id = $1 for update',
      [orderId],
      client,
    );
    if (!order) throw new OrderError('Order not found.');
    if (order.status === 'cancelled') return;
    if (order.status === 'shipped' || order.status === 'delivered')
      throw new OrderError('Shipped orders cannot be cancelled. Process a return and refund instead.');
    await query(`update orders set status = 'cancelled', updated_at = now() where id = $1`, [order.id], client);
    await releaseStock(order.id, client);
    if (order.coupon_id)
      await query('update coupons set used_count = greatest(used_count - 1, 0) where id = $1', [order.coupon_id], client);
    await audit({ actor, action: 'order.cancelled', entityType: 'order', entityId: order.id, details: { reason } }, client);
  });
}

export async function getOrderByNumber(number: string): Promise<Order | null> {
  const row = await queryOne(`select ${ORDER_COLUMNS} from orders where number = $1`, [number.trim().toUpperCase()]);
  return row ? toOrder(row) : null;
}

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await queryOne(`select ${ORDER_COLUMNS} from orders where id = $1`, [id]);
  return row ? toOrder(row) : null;
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const rows = await query<{
    id: string;
    product_id: string | null;
    product_name: string;
    product_slug: string;
    sku: string;
    size: string;
    color: string;
    image_url: string | null;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
  }>('select * from order_items where order_id = $1 order by product_name', [orderId]);
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    productSlug: r.product_slug,
    sku: r.sku,
    size: r.size,
    color: r.color,
    imageUrl: r.image_url,
    unitPriceCents: r.unit_price_cents,
    quantity: r.quantity,
    lineTotalCents: r.line_total_cents,
  }));
}

/** An order is visible to its owner, or to anyone holding the access key from the confirmation link. */
export async function canViewOrder(order: Order, user: SessionUser | null, key?: string | null): Promise<boolean> {
  if (user && order.userId === user.id) return true;
  if (!key) return false;
  const row = await queryOne('select 1 from orders where id = $1 and access_key_hash = $2', [order.id, hashToken(key)]);
  return !!row;
}

export async function listOrdersForUser(userId: string): Promise<(Order & { itemCount: number })[]> {
  const rows = await query(
    `select ${ORDER_COLUMNS}, (select coalesce(sum(quantity), 0) from order_items oi where oi.order_id = orders.id) as item_count
       from orders where user_id = $1 order by created_at desc limit 100`,
    [userId],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((r: any) => ({ ...toOrder(r), itemCount: r.item_count }));
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Awaiting payment',
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
};
