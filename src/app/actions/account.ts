'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { addressSchema, zodFieldErrors } from '@/lib/checkout-schema';
import { query, queryOne, transaction } from '@/lib/db';
import { hashPassword, hashToken, verifyPassword } from '@/lib/password';
import { rateLimit } from '@/lib/rate-limit';
import { cookies } from 'next/headers';
import type { FormState } from './auth';

const name = z.string().trim().min(1, 'Required.').max(80);

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Sign in first.' };
  const parsed = z
    .object({ firstName: name, lastName: name, phone: z.string().trim().max(30).optional(), marketing: z.boolean() })
    .safeParse({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone') ?? '',
      marketing: formData.get('marketing') === 'on',
    });
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.', fields: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  await query(
    `insert into profiles (user_id, first_name, last_name, phone, marketing_opt_in) values ($1, $2, $3, $4, $5)
     on conflict (user_id) do update set first_name = $2, last_name = $3, phone = $4, marketing_opt_in = $5, updated_at = now()`,
    [user.id, d.firstName, d.lastName, d.phone || null, d.marketing],
  );
  revalidatePath('/account', 'layout');
  return { ok: true, message: 'Profile saved.' };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Sign in first.' };
  if (!rateLimit(`pw:${user.id}`, 5, 10 * 60_000)) return { ok: false, message: 'Too many attempts. Try again in ten minutes.' };
  const parsed = z
    .object({
      current: z.string().min(1, 'Enter your current password.').max(200),
      password: z
        .string()
        .min(10, 'Use at least 10 characters.')
        .max(200)
        .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number.'),
    })
    .safeParse({ current: formData.get('current'), password: formData.get('password') });
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.', fields: zodFieldErrors(parsed.error) };
  const row = await queryOne<{ password_hash: string }>('select password_hash from users where id = $1', [user.id]);
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash)))
    return { ok: false, message: 'Check the highlighted fields.', fields: { current: 'That is not your current password.' } };
  await query('update users set password_hash = $1 where id = $2', [await hashPassword(parsed.data.password), user.id]);
  // Sign out every other device.
  const token = (await cookies()).get('hs')?.value;
  await query('delete from sessions where user_id = $1 and token_hash <> $2', [user.id, token ? hashToken(token) : '']);
  await audit({ actor: user, action: 'auth.password_changed', entityType: 'user', entityId: user.id });
  return { ok: true, message: 'Password changed. Other devices have been signed out.' };
}

export async function saveAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Sign in first.' };
  const parsed = addressSchema
    .extend({
      id: z.string().uuid().optional(),
      label: z.string().trim().min(1, 'Give this address a name, like Home.').max(40),
      firstName: name,
      lastName: name,
      phone: z.string().trim().max(30).optional(),
      isDefault: z.boolean(),
    })
    .safeParse({
      id: formData.get('id') || undefined,
      label: formData.get('label'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      line1: formData.get('line1'),
      line2: formData.get('line2') ?? '',
      city: formData.get('city'),
      region: formData.get('region') ?? '',
      postalCode: formData.get('postalCode'),
      country: formData.get('country'),
      phone: formData.get('phone') ?? '',
      isDefault: formData.get('isDefault') === 'on',
    });
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.', fields: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  const result = await transaction(async (client) => {
    const count = await queryOne<{ n: number }>('select count(*) as n from addresses where user_id = $1', [user.id], client);
    if (!d.id && (count?.n ?? 0) >= 10) return 'limit';
    const makeDefault = d.isDefault || (count?.n ?? 0) === 0;
    if (makeDefault) await query('update addresses set is_default = false where user_id = $1', [user.id], client);
    const values = [d.label, d.firstName, d.lastName, d.line1, d.line2 || null, d.city, d.region || null, d.postalCode, d.country, d.phone || null];
    if (d.id) {
      // The user_id condition is the authorization check: you can only edit your own rows.
      const updated = await query(
        `update addresses set label=$1, first_name=$2, last_name=$3, line1=$4, line2=$5, city=$6, region=$7, postal_code=$8,
                country=$9, phone=$10, is_default = (is_default or $11) where id = $12 and user_id = $13 returning id`,
        [...values, makeDefault, d.id, user.id],
        client,
      );
      if (!updated.length) return 'missing';
    } else {
      await query(
        `insert into addresses (label, first_name, last_name, line1, line2, city, region, postal_code, country, phone, is_default, user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [...values, makeDefault, user.id],
        client,
      );
    }
    return 'ok';
  });
  if (result === 'limit') return { ok: false, message: 'You can save up to 10 addresses. Remove one first.' };
  if (result === 'missing') return { ok: false, message: 'That address no longer exists.' };
  revalidatePath('/account/addresses');
  return { ok: true, message: 'Address saved.' };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!user || !id.success) return;
  await query('delete from addresses where id = $1 and user_id = $2', [id.data, user.id]);
  revalidatePath('/account/addresses');
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!user || !id.success) return;
  await transaction(async (client) => {
    const own = await queryOne('select 1 from addresses where id = $1 and user_id = $2', [id.data, user.id], client);
    if (!own) return;
    await query('update addresses set is_default = false where user_id = $1', [user.id], client);
    await query('update addresses set is_default = true where id = $1 and user_id = $2', [id.data, user.id], client);
  });
  revalidatePath('/account/addresses');
}
