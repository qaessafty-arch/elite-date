'use server';

import { z } from 'zod';
import {
  addToCart,
  applyCoupon,
  CartError,
  changeLineVariant,
  getCartView,
  removeCoupon,
  setLineQuantity,
  toggleWishlist,
  type CartView,
} from '@/lib/cart';
import { limitByIp } from '@/lib/rate-limit';
import { query } from '@/lib/db';

export type CartResult = { ok: true; cart: CartView } | { ok: false; error: string; cart?: CartView };

const uuid = z.string().uuid();

async function run(fn: () => Promise<void>): Promise<CartResult> {
  if (!(await limitByIp('cart', 120))) return { ok: false, error: 'Too many requests. Wait a moment and try again.' };
  try {
    await fn();
    return { ok: true, cart: await getCartView() };
  } catch (err) {
    if (err instanceof CartError) return { ok: false, error: err.message, cart: await getCartView() };
    if (err instanceof z.ZodError) return { ok: false, error: 'That request was not valid.' };
    console.error('[cart]', err);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<CartResult> {
  return run(async () => {
    await addToCart(uuid.parse(variantId), z.number().int().min(1).max(10).parse(quantity));
  });
}

export async function setQuantityAction(lineId: string, quantity: number): Promise<CartResult> {
  return run(async () => {
    await setLineQuantity(uuid.parse(lineId), z.number().int().min(0).max(10).parse(quantity));
  });
}

export async function changeVariantAction(lineId: string, variantId: string): Promise<CartResult> {
  return run(async () => {
    await changeLineVariant(uuid.parse(lineId), uuid.parse(variantId));
  });
}

export async function applyCouponAction(code: string): Promise<CartResult> {
  if (!(await limitByIp('coupon', 10))) return { ok: false, error: 'Too many attempts. Try again in a minute.' };
  return run(async () => {
    await applyCoupon(z.string().trim().min(2).max(40).parse(code));
  });
}

export async function removeCouponAction(): Promise<CartResult> {
  return run(removeCoupon);
}

export async function toggleWishlistAction(
  productId: string,
): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> {
  if (!(await limitByIp('wishlist', 60))) return { ok: false, error: 'Too many requests. Try again shortly.' };
  try {
    return { ok: true, saved: await toggleWishlist(uuid.parse(productId)) };
  } catch (err) {
    if (err instanceof CartError) return { ok: false, error: err.message };
    return { ok: false, error: 'We could not update your wishlist.' };
  }
}

export async function subscribeNewsletterAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  if (!(await limitByIp('newsletter', 5))) return { ok: false, message: 'Too many attempts. Try again in a minute.' };
  const parsed = z.string().trim().toLowerCase().email().max(200).safeParse(formData.get('email'));
  if (!parsed.success) return { ok: false, message: 'Enter a valid email address, like name@example.com.' };
  try {
    await query('insert into newsletter_subscribers (email) values ($1) on conflict (email) do nothing', [parsed.data]);
    return { ok: true, message: 'You are on the list. We write about twice a month.' };
  } catch (err) {
    console.error('[newsletter]', err);
    return { ok: false, message: 'We could not save your email. Please try again.' };
  }
}
