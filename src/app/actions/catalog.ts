'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getProductsByIds, type ProductCard } from '@/lib/catalog';
import { query, queryOne } from '@/lib/db';
import { limitByIp } from '@/lib/rate-limit';

export async function recentlyViewedAction(ids: string[]): Promise<ProductCard[]> {
  const parsed = z.array(z.string().uuid()).max(12).safeParse(ids);
  if (!parsed.success || !(await limitByIp('recent', 60))) return [];
  return getProductsByIds(parsed.data);
}

export type ReviewState = { ok: boolean; message: string } | null;

/** Signed-in customers can leave one review per product. "Verified" is derived from their paid orders. */
export async function submitReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Sign in to write a review.' };
  if (!(await limitByIp('review', 5, 10 * 60_000))) return { ok: false, message: 'Too many attempts. Try again later.' };
  const parsed = z
    .object({
      productId: z.string().uuid(),
      rating: z.coerce.number().int().min(1).max(5),
      title: z.string().trim().min(2, 'Add a short headline.').max(80),
      body: z.string().trim().min(10, 'Tell us a little more, at least 10 characters.').max(1500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check your review and try again.' };
  const d = parsed.data;
  const product = await queryOne<{ slug: string }>(`select slug from products where id = $1 and status = 'published'`, [d.productId]);
  if (!product) return { ok: false, message: 'That product is no longer available.' };
  const bought = await queryOne(
    `select 1 from orders o join order_items oi on oi.order_id = o.id
      where o.user_id = $1 and oi.product_id = $2 and o.payment_status in ('paid', 'partially_refunded') limit 1`,
    [user.id, d.productId],
  );
  const author = `${user.firstName || 'Customer'} ${user.lastName ? user.lastName[0] + '.' : ''}`.trim();
  await query(
    `insert into reviews (product_id, user_id, author_name, rating, title, body, is_verified_purchase)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (product_id, user_id) where user_id is not null
     do update set rating = excluded.rating, title = excluded.title, body = excluded.body, created_at = now()`,
    [d.productId, user.id, author, d.rating, d.title, d.body, !!bought],
  );
  revalidatePath(`/products/${product.slug}`);
  return { ok: true, message: 'Thank you. Your review is live.' };
}
