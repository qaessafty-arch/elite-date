'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getCartView, loadCartLines, loadCoupon } from '@/lib/cart';
import { checkoutSchema, zodFieldErrors } from '@/lib/checkout-schema';
import { query, queryOne } from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { formatMoney } from '@/lib/money';
import { cancelOrder, getOrderByNumber, markOrderPaid, OrderError, placeOrder, canViewOrder } from '@/lib/orders';
import { availableProviders, createStripeCheckout } from '@/lib/payments';
import { limitByIp } from '@/lib/rate-limit';
import { getSettings, siteUrl } from '@/lib/settings';
import { computeTotals, couponProblem, type Totals } from '@/lib/totals';

/** Server-computed totals for the current bag with a given delivery method. */
export async function quoteCheckoutAction(shippingMethodId: string | null): Promise<Totals | null> {
  const cart = await getCartView();
  if (!cart.id || !cart.lines.length) return null;
  const settings = await getSettings();
  const method =
    shippingMethodId && z.string().uuid().safeParse(shippingMethodId).success
      ? await queryOne<{ price_cents: number; free_over_cents: number | null }>(
          'select price_cents, free_over_cents from shipping_methods where id = $1 and is_active',
          [shippingMethodId],
        )
      : null;
  const cartRow = await queryOne<{ coupon_id: string | null }>('select coupon_id from carts where id = $1', [cart.id]);
  let coupon = await loadCoupon(cartRow?.coupon_id ?? null);
  const lines = await loadCartLines(cart.id);
  if (coupon && couponProblem(coupon, lines.reduce((s, l) => s + l.lineTotalCents, 0))) coupon = null;
  return computeTotals({ lines, coupon, shipping: method, taxRatePercent: settings.tax.ratePercent });
}

export type PlaceOrderResult =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string; fields?: Record<string, string> };

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  if (!(await limitByIp('place-order', 8, 10 * 60_000)))
    return { ok: false, message: 'Too many attempts. Wait a few minutes and try again.' };
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Some details need another look.', fields: zodFieldErrors(parsed.error) };
  const d = parsed.data;

  const [settings, user, cart] = await Promise.all([getSettings(), getCurrentUser(), getCartView()]);
  if (!cart.id || !cart.lines.length) return { ok: false, message: 'Your bag is empty.' };
  if (!availableProviders(settings).some((p) => p.id === d.provider))
    return { ok: false, message: 'That payment method is not available. Choose another one.' };

  let order: Awaited<ReturnType<typeof placeOrder>>;
  try {
    order = await placeOrder(cart.id, d, user);
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, message: err.message };
    console.error('[checkout] placeOrder failed', err);
    return { ok: false, message: 'We could not place your order. Nothing was charged. Please try again.' };
  }

  if (user && d.saveAddress) {
    const exists = await queryOne(
      'select 1 from addresses where user_id = $1 and line1 = $2 and postal_code = $3',
      [user.id, d.line1, d.postalCode],
    );
    if (!exists) {
      const hasDefault = await queryOne('select 1 from addresses where user_id = $1 and is_default', [user.id]);
      await query(
        `insert into addresses (user_id, label, first_name, last_name, line1, line2, city, region, postal_code, country, phone, is_default)
         values ($1, 'Saved at checkout', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [user.id, d.firstName, d.lastName, d.line1, d.line2 || null, d.city, d.region || null, d.postalCode, d.country, d.phone || null, !hasDefault],
      );
    }
  }

  const orderUrl = `/orders/${order.number}?key=${order.accessKey}`;
  const mail = () =>
    sendMail({
      to: d.email,
      subject: `${settings.brand.name} order ${order.number}`,
      text: `Thank you, ${d.firstName}.\n\nWe have your order ${order.number} for ${formatMoney(order.totalCents, order.currency, settings.locale.locale)}.\nFollow it here: ${siteUrl()}${orderUrl}\n\n${settings.brand.name}`,
    });

  if (d.provider === 'demo') {
    try {
      await markOrderPaid(order.id, { provider: 'demo', providerRef: `demo_${order.number}`, amountCents: order.totalCents });
    } catch (err) {
      console.error('[checkout] demo payment failed', err);
      await cancelOrder(order.id, null, 'Demo payment could not be recorded');
      return { ok: false, message: 'The payment could not be recorded, so the order was cancelled. Please try again.' };
    }
    await mail();
    return { ok: true, redirectTo: `${orderUrl}&placed=1` };
  }

  try {
    const url = await createStripeCheckout({
      id: order.id,
      number: order.number,
      email: d.email,
      totalCents: order.totalCents,
      currency: order.currency,
      accessKey: order.accessKey,
    });
    await mail();
    return { ok: true, redirectTo: url };
  } catch (err) {
    console.error('[checkout] stripe session failed', err);
    await cancelOrder(order.id, null, 'Payment session could not be created');
    return { ok: false, message: 'We could not reach the payment provider. Nothing was charged and your bag is unchanged in stock. Please try again.' };
  }
}

/** Lets a customer return to Stripe for an order that is still unpaid. */
export async function resumePaymentAction(number: string, key: string): Promise<{ ok: boolean; url?: string; message?: string }> {
  if (!(await limitByIp('resume-payment', 6, 10 * 60_000))) return { ok: false, message: 'Too many attempts. Try again shortly.' };
  const order = await getOrderByNumber(String(number));
  const user = await getCurrentUser();
  if (!order || !(await canViewOrder(order, user, key))) return { ok: false, message: 'Order not found.' };
  if (order.paymentStatus !== 'unpaid' || order.status !== 'pending') return { ok: false, message: 'This order does not need a payment.' };
  const settings = await getSettings();
  if (!availableProviders(settings).some((p) => p.id === 'stripe')) return { ok: false, message: 'Card payments are not available right now.' };
  try {
    await query(`delete from payments where order_id = $1 and status = 'pending'`, [order.id]);
    const url = await createStripeCheckout({
      id: order.id,
      number: order.number,
      email: order.email,
      totalCents: order.totalCents,
      currency: order.currency,
      accessKey: key,
    });
    return { ok: true, url };
  } catch (err) {
    console.error('[checkout] resume payment failed', err);
    return { ok: false, message: 'We could not reach the payment provider. Please try again.' };
  }
}

export type TrackState = { ok: boolean; message?: string; order?: { number: string; status: string; statusLabel: string; placed: string; carrier: string | null; tracking: string | null; method: string } } | null;

export async function trackOrderAction(_prev: TrackState, formData: FormData): Promise<TrackState> {
  if (!(await limitByIp('track', 10, 10 * 60_000))) return { ok: false, message: 'Too many attempts. Try again in a few minutes.' };
  const parsed = z
    .object({ number: z.string().trim().min(4).max(20), email: z.string().trim().toLowerCase().email() })
    .safeParse({ number: formData.get('number'), email: formData.get('email') });
  if (!parsed.success) return { ok: false, message: 'Enter your order number and the email you ordered with.' };
  const order = await getOrderByNumber(parsed.data.number);
  // Same message for "no such order" and "wrong email" so order numbers cannot be probed.
  if (!order || order.email.toLowerCase() !== parsed.data.email)
    return { ok: false, message: 'We could not find an order with that number and email. Check both and try again.' };
  const { ORDER_STATUS_LABEL } = await import('@/lib/orders');
  const settings = await getSettings();
  return {
    ok: true,
    order: {
      number: order.number,
      status: order.status,
      statusLabel: ORDER_STATUS_LABEL[order.status],
      placed: order.createdAt.toLocaleDateString(settings.locale.locale, { year: 'numeric', month: 'long', day: 'numeric' }),
      carrier: order.trackingCarrier,
      tracking: order.trackingNumber,
      method: order.shippingMethodName,
    },
  };
}
