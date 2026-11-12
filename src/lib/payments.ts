import Stripe from 'stripe';
import { query, queryOne, transaction } from './db';
import { audit } from './audit';
import { getSettings, siteUrl, type StoreSettings } from './settings';

export type PaymentProvider = { id: 'stripe' | 'demo'; label: string; description: string };

let stripeClient: Stripe | null = null;
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

/**
 * Demo payments never charge anyone. They are available in development, and in
 * production only when PAYMENTS_DEMO_MODE=true is set explicitly (demo deployments).
 */
export function demoPaymentsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.PAYMENTS_DEMO_MODE === 'true';
}

export function availableProviders(settings: StoreSettings): PaymentProvider[] {
  const list: PaymentProvider[] = [];
  if (settings.payments.stripe && process.env.STRIPE_SECRET_KEY)
    list.push({
      id: 'stripe',
      label: 'Card, Apple Pay, Google Pay',
      description: 'You will finish payment on Stripe’s secure page. We never see or store your card details.',
    });
  if (settings.payments.demo && demoPaymentsAllowed())
    list.push({
      id: 'demo',
      label: 'Demo payment',
      description: 'Test mode. The order is marked as paid and no money moves.',
    });
  return list;
}

/** Creates a Stripe Checkout session for an existing unpaid order and returns its URL. */
export async function createStripeCheckout(order: {
  id: string;
  number: string;
  email: string;
  totalCents: number;
  currency: string;
  accessKey: string;
}): Promise<string> {
  const client = stripe();
  if (!client) throw new Error('Stripe is not configured.');
  const settings = await getSettings();
  const base = siteUrl();
  const session = await client.checkout.sessions.create({
    mode: 'payment',
    customer_email: order.email,
    client_reference_id: order.id,
    metadata: { order_id: order.id, order_number: order.number },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: order.currency.toLowerCase(),
          unit_amount: order.totalCents,
          product_data: { name: `${settings.brand.name} order ${order.number}` },
        },
      },
    ],
    success_url: `${base}/orders/${order.number}?key=${order.accessKey}&placed=1`,
    cancel_url: `${base}/orders/${order.number}?key=${order.accessKey}&payment=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 45,
  });
  if (!session.url) throw new Error('Stripe did not return a checkout URL.');
  await query(
    `insert into payments (order_id, provider, provider_ref, amount_cents, currency, status)
     values ($1, 'stripe', $2, $3, $4, 'pending')`,
    [order.id, session.id, order.totalCents, order.currency],
  );
  return session.url;
}

export class RefundError extends Error {}

/**
 * Refunds part or all of the captured payment through the provider that took it.
 * Demo payments are only adjusted in the database.
 */
export async function refundOrder(
  orderId: string,
  amountCents: number,
  actor: { id: string; email: string },
): Promise<void> {
  const payment = await queryOne<{
    id: string;
    provider: 'stripe' | 'demo';
    provider_ref: string | null;
    amount_cents: number;
    refunded_cents: number;
  }>(
    `select id, provider, provider_ref, amount_cents, refunded_cents from payments
      where order_id = $1 and status in ('succeeded', 'partially_refunded') order by created_at desc limit 1`,
    [orderId],
  );
  if (!payment) throw new RefundError('There is no captured payment to refund on this order.');
  const remaining = payment.amount_cents - payment.refunded_cents;
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new RefundError('Enter a refund amount above zero.');
  if (amountCents > remaining) throw new RefundError('The refund is larger than the amount still refundable.');

  if (payment.provider === 'stripe') {
    const client = stripe();
    if (!client || !payment.provider_ref) throw new RefundError('Stripe is not configured, so this refund cannot be sent.');
    await client.refunds.create({ payment_intent: payment.provider_ref, amount: amountCents });
  }

  await transaction(async (db) => {
    const full = payment.refunded_cents + amountCents === payment.amount_cents;
    await query(
      `update payments set refunded_cents = refunded_cents + $1, status = $2, updated_at = now() where id = $3`,
      [amountCents, full ? 'refunded' : 'partially_refunded', payment.id],
      db,
    );
    await query(`update orders set payment_status = $1, updated_at = now() where id = $2`, [
      full ? 'refunded' : 'partially_refunded',
      orderId,
    ], db);
    await audit(
      {
        actor,
        action: 'order.refunded',
        entityType: 'order',
        entityId: orderId,
        details: { amountCents, provider: payment.provider, full },
      },
      db,
    );
  });
}
