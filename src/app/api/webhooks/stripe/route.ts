import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { cancelOrder, markOrderPaid } from '@/lib/orders';
import { stripe } from '@/lib/payments';

/**
 * Stripe webhook. Payment state only ever changes here, after the signature
 * is verified — never from the browser redirect.
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 *         checkout.session.expired, checkout.session.async_payment_failed
 */
export async function POST(request: Request) {
  const client = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!client || !secret) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  let event;
  try {
    event = client.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type.startsWith('checkout.session.')) {
    const session = event.data.object as {
      id: string;
      client_reference_id: string | null;
      payment_status: string;
      amount_total: number | null;
      payment_intent: string | { id: string } | null;
    };
    const orderId = session.client_reference_id;
    const order = orderId ? await queryOne<{ id: string; total_cents: number }>('select id, total_cents from orders where id = $1', [orderId]) : null;
    if (order) {
      const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
      if (paid && session.payment_status === 'paid' && session.amount_total === order.total_cents) {
        const intent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? session.id);
        await markOrderPaid(order.id, { provider: 'stripe', providerRef: intent, amountCents: order.total_cents });
      } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
        await cancelOrder(order.id, null, `Stripe: ${event.type}`).catch(() => {});
      }
    }
  }
  return NextResponse.json({ received: true });
}
