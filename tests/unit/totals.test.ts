import { describe, expect, it } from 'vitest';
import { computeTotals, couponDiscount, couponProblem, shippingCost, type CouponRule } from '../../src/lib/totals';

const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  id: 'c', code: 'X', description: '', kind: 'percent', value: 10, min_subtotal_cents: 0,
  starts_at: null, expires_at: null, usage_limit: null, used_count: 0, is_active: true, ...over,
});

describe('order totals', () => {
  it('applies a percentage discount, shipping and tax on the discounted subtotal', () => {
    const t = computeTotals({
      lines: [{ unitPriceCents: 42000, quantity: 2 }],
      coupon: coupon(),
      shipping: { price_cents: 1800, free_over_cents: null },
      taxRatePercent: 8,
    });
    expect(t).toEqual({ subtotalCents: 84000, discountCents: 8400, shippingCents: 1800, taxCents: 6048, totalCents: 83448 });
  });

  it('never discounts below zero', () => {
    expect(couponDiscount(coupon({ kind: 'fixed', value: 99999 }), 5000)).toBe(5000);
  });

  it('makes shipping free above the threshold, measured after discount', () => {
    expect(shippingCost({ price_cents: 800, free_over_cents: 20000 }, 20000)).toBe(0);
    expect(shippingCost({ price_cents: 800, free_over_cents: 20000 }, 19999)).toBe(800);
  });

  it('rejects expired, inactive, exhausted and under-minimum coupons', () => {
    const now = new Date('2026-06-01');
    expect(couponProblem(coupon({ expires_at: new Date('2026-05-01') }), 1000, now)).toMatch(/expired/);
    expect(couponProblem(coupon({ is_active: false }), 1000, now)).toMatch(/no longer active/);
    expect(couponProblem(coupon({ usage_limit: 5, used_count: 5 }), 1000, now)).toMatch(/usage limit/);
    expect(couponProblem(coupon({ min_subtotal_cents: 25000 }), 1000, now)).toMatch(/at least/);
    expect(couponProblem(coupon(), 1000, now)).toBeNull();
  });
});
