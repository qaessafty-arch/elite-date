/**
 * Pure order maths, shared by the cart, checkout and order placement.
 * Everything here runs on the server with prices read from the database —
 * the browser never supplies a price, discount or total.
 */

export type CouponRule = {
  id: string;
  code: string;
  description: string;
  kind: 'percent' | 'fixed';
  value: number;
  min_subtotal_cents: number;
  starts_at: Date | null;
  expires_at: Date | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
};

export type ShippingRule = { price_cents: number; free_over_cents: number | null };

export type Totals = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

/** Returns null when the coupon can be used, otherwise a customer-facing reason. */
export function couponProblem(coupon: CouponRule, subtotalCents: number, now = new Date()): string | null {
  if (!coupon.is_active) return 'This code is no longer active.';
  if (coupon.starts_at && coupon.starts_at > now) return 'This code is not active yet.';
  if (coupon.expires_at && coupon.expires_at <= now) return 'This code has expired.';
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)
    return 'This code has reached its usage limit.';
  if (subtotalCents < coupon.min_subtotal_cents)
    return `This code needs a subtotal of at least ${(coupon.min_subtotal_cents / 100).toFixed(2)}.`;
  return null;
}

export function couponDiscount(coupon: CouponRule | null, subtotalCents: number): number {
  if (!coupon) return 0;
  const raw = coupon.kind === 'percent' ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value;
  return Math.max(0, Math.min(raw, subtotalCents));
}

export function shippingCost(method: ShippingRule | null, discountedSubtotalCents: number): number {
  if (!method) return 0;
  if (method.free_over_cents !== null && discountedSubtotalCents >= method.free_over_cents) return 0;
  return method.price_cents;
}

export function computeTotals(input: {
  lines: { unitPriceCents: number; quantity: number }[];
  coupon: CouponRule | null;
  shipping: ShippingRule | null;
  taxRatePercent: number;
}): Totals {
  const subtotalCents = input.lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const discountCents = couponDiscount(input.coupon, subtotalCents);
  const discounted = subtotalCents - discountCents;
  const shippingCents = shippingCost(input.shipping, discounted);
  const taxCents = Math.round((discounted * Math.max(0, input.taxRatePercent)) / 100);
  return { subtotalCents, discountCents, shippingCents, taxCents, totalCents: discounted + shippingCents + taxCents };
}
