'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { createSession, destroyAllSessions, destroySession, getCurrentUser } from '@/lib/auth';
import { mergeVisitorData } from '@/lib/cart';
import { query, queryOne, transaction } from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { hashPassword, hashToken, newToken, verifyPassword } from '@/lib/password';
import { clientIp, limitByIp, rateLimit } from '@/lib/rate-limit';
import { getSettings, siteUrl } from '@/lib/settings';

export type FormState = { ok: boolean; message: string; fields?: Record<string, string> } | null;

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(200);
const password = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'Use 200 characters or fewer.')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number.');
const name = z.string().trim().min(1, 'Required.').max(80);

/** Only same-site relative paths are allowed as post-login destinations. */
function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const v = typeof value === 'string' ? value : '';
  return v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') ? v : fallback;
}

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function issueToken(userId: string, kind: 'verify_email' | 'reset_password', ttlMinutes: number): Promise<string> {
  const token = newToken();
  await query('delete from auth_tokens where user_id = $1 and kind = $2', [userId, kind]);
  await query(
    `insert into auth_tokens (user_id, kind, token_hash, expires_at) values ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [userId, kind, hashToken(token), String(ttlMinutes)],
  );
  return token;
}

async function sendVerification(userId: string, to: string) {
  const { brand } = await getSettings();
  const token = await issueToken(userId, 'verify_email', 60 * 24 * 3);
  await sendMail({
    to,
    subject: `Confirm your email for ${brand.name}`,
    text: `Welcome to ${brand.name}.\n\nConfirm your email address by opening this link:\n${siteUrl()}/account/verify?token=${token}\n\nThe link works for 3 days. If you did not create an account, ignore this email.`,
  });
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await limitByIp('register', 5, 10 * 60_000)))
    return { ok: false, message: 'Too many attempts. Try again in a few minutes.' };
  const parsed = z
    .object({ email, password, firstName: name, lastName: name, marketing: z.boolean() })
    .safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      marketing: formData.get('marketing') === 'on',
    });
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.', fields: fieldErrors(parsed.error) };
  const d = parsed.data;

  const hash = await hashPassword(d.password);
  let userId: string;
  try {
    userId = await transaction(async (client) => {
      const user = await queryOne<{ id: string }>(
        `insert into users (email, password_hash, role_id)
         values ($1, $2, (select id from roles where key = 'customer')) returning id`,
        [d.email, hash],
        client,
      );
      await query(
        'insert into profiles (user_id, first_name, last_name, marketing_opt_in) values ($1, $2, $3, $4)',
        [user!.id, d.firstName, d.lastName, d.marketing],
        client,
      );
      // Attach earlier guest orders placed with the same email.
      await query('update orders set user_id = $1 where user_id is null and email = $2', [user!.id, d.email], client);
      return user!.id;
    });
  } catch (err) {
    if ((err as { code?: string }).code === '23505')
      return { ok: false, message: 'Check the highlighted fields.', fields: { email: 'An account with this email already exists. Sign in instead.' } };
    throw err;
  }

  await sendVerification(userId, d.email);
  await createSession(userId);
  await mergeVisitorData(userId);
  redirect(safeNext(formData.get('next'), '/account?welcome=1'));
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1).max(200) })
    .safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { ok: false, message: 'Enter your email and password.' };
  const ip = await clientIp();
  // Throttle by IP and by account so neither a single address nor a botnet can brute-force one login.
  if (!rateLimit(`login-ip:${ip}`, 12, 10 * 60_000) || !rateLimit(`login-acct:${parsed.data.email}`, 8, 10 * 60_000))
    return { ok: false, message: 'Too many sign-in attempts. Wait ten minutes and try again.' };

  const user = await queryOne<{ id: string; password_hash: string; status: string }>(
    'select id, password_hash, status from users where email = $1',
    [parsed.data.email],
  );
  // Always run a hash comparison so response time does not reveal whether the account exists.
  const valid = await verifyPassword(
    parsed.data.password,
    user?.password_hash ?? 'scrypt$32768$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  );
  if (!user || !valid) return { ok: false, message: 'That email and password do not match an account.' };
  if (user.status !== 'active')
    return { ok: false, message: 'This account has been suspended. Contact customer care for help.' };

  await createSession(user.id);
  await mergeVisitorData(user.id);
  await audit({ actor: { id: user.id, email: parsed.data.email }, action: 'auth.login', entityType: 'user', entityId: user.id, ip });
  redirect(safeNext(formData.get('next'), '/account'));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await limitByIp('reset-request', 5, 10 * 60_000)))
    return { ok: false, message: 'Too many attempts. Try again in a few minutes.' };
  const parsed = email.safeParse(formData.get('email'));
  if (!parsed.success) return { ok: false, message: 'Enter a valid email address.' };
  const user = await queryOne<{ id: string }>(`select id from users where email = $1 and status = 'active'`, [parsed.data]);
  if (user) {
    const { brand } = await getSettings();
    const token = await issueToken(user.id, 'reset_password', 60);
    await sendMail({
      to: parsed.data,
      subject: `Reset your ${brand.name} password`,
      text: `Open this link to choose a new password:\n${siteUrl()}/account/reset-password?token=${token}\n\nThe link works for 1 hour. If you did not ask for it, you can ignore this email.`,
    });
  }
  // Same answer whether or not the account exists.
  return { ok: true, message: 'If an account exists for that address, a reset link is on its way. It works for one hour.' };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await limitByIp('reset', 10, 10 * 60_000))) return { ok: false, message: 'Too many attempts. Try again shortly.' };
  const parsed = z
    .object({ token: z.string().min(20).max(200), password })
    .safeParse({ token: formData.get('token'), password: formData.get('password') });
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.', fields: fieldErrors(parsed.error) };
  const hash = await hashPassword(parsed.data.password);
  const userId = await transaction(async (client) => {
    const token = await queryOne<{ id: string; user_id: string }>(
      `update auth_tokens set used_at = now()
        where token_hash = $1 and kind = 'reset_password' and used_at is null and expires_at > now()
        returning id, user_id`,
      [hashToken(parsed.data.token)],
      client,
    );
    if (!token) return null;
    await query('update users set password_hash = $1 where id = $2', [hash, token.user_id], client);
    await audit({ action: 'auth.password_reset', entityType: 'user', entityId: token.user_id }, client);
    return token.user_id;
  });
  if (!userId) return { ok: false, message: 'This reset link has expired or was already used. Request a new one.' };
  await destroyAllSessions(userId);
  redirect('/account/login?reset=1');
}

/** Consumes an email verification token. Returns true when the address is now verified. */
export async function verifyEmailToken(token: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const row = await queryOne<{ user_id: string }>(
    `update auth_tokens set used_at = now()
      where token_hash = $1 and kind = 'verify_email' and used_at is null and expires_at > now()
      returning user_id`,
    [hashToken(token)],
  );
  if (!row) return false;
  await query('update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1', [row.user_id]);
  return true;
}

export async function resendVerificationAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Sign in first.' };
  if (user.emailVerified) return { ok: true, message: 'Your email is already confirmed.' };
  if (!rateLimit(`verify:${user.id}`, 3, 10 * 60_000)) return { ok: false, message: 'We just sent one. Check your inbox, or try again in ten minutes.' };
  await sendVerification(user.id, user.email);
  return { ok: true, message: `We sent a new confirmation link to ${user.email}.` };
}
