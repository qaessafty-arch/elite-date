import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { query, queryOne } from './db';
import { hashToken, newToken } from './password';

export const SESSION_COOKIE = 'hs';
export const VISITOR_COOKIE = 'hv';
const SESSION_DAYS = 30;

export { PERMISSIONS, type Permission } from './permissions';
import type { Permission } from './permissions';

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  roleName: string;
  permissions: string[];
  firstName: string;
  lastName: string;
  emailVerified: boolean;
};

const secure = process.env.NODE_ENV === 'production';

/** The signed-in user for this request, or null. Suspended accounts are treated as signed out. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await queryOne<{
    id: string;
    email: string;
    role: string;
    role_name: string;
    permissions: string[];
    first_name: string | null;
    last_name: string | null;
    email_verified_at: Date | null;
  }>(
    `select u.id, u.email, r.key as role, r.name as role_name, r.permissions,
            p.first_name, p.last_name, u.email_verified_at
       from sessions s
       join users u on u.id = s.user_id
       join roles r on r.id = u.role_id
       left join profiles p on p.user_id = u.id
      where s.token_hash = $1 and s.expires_at > now() and u.status = 'active'`,
    [hashToken(token)],
  );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    roleName: row.role_name,
    permissions: row.permissions,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    emailVerified: !!row.email_verified_at,
  };
});

export function can(user: SessionUser | null, permission: Permission): boolean {
  return !!user && user.permissions.includes(permission);
}

/** Call from server actions / route handlers only (sets a cookie). */
export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const h = await headers();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query(
    `insert into sessions (user_id, token_hash, expires_at, ip, user_agent) values ($1, $2, $3, $4, $5)`,
    [
      userId,
      hashToken(token),
      expires,
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      h.get('user-agent')?.slice(0, 300) ?? null,
    ],
  );
  await query('update users set last_login_at = now() where id = $1', [userId]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query('delete from sessions where token_hash = $1', [hashToken(token)]);
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await query('delete from sessions where user_id = $1', [userId]);
}

/** For customer pages: redirects to the login page when signed out. */
export async function requireUser(next = '/account'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** For admin pages: redirects when signed out or lacking the permission. */
export async function requireAdmin(permission: Permission = 'dashboard.view'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'dashboard.view')) redirect('/admin/login?denied=1');
  if (!can(user, permission)) redirect('/admin?denied=' + encodeURIComponent(permission));
  return user;
}

/** For admin server actions: throws instead of redirecting so nothing is mutated. */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !can(user, permission)) throw new Error('You do not have permission to do that.');
  return user;
}

// ---- Visitor cookie (guest cart + wishlist) --------------------------------

export async function getVisitorHash(): Promise<string | null> {
  const token = (await cookies()).get(VISITOR_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/** Call from server actions / route handlers only (may set a cookie). */
export async function ensureVisitorHash(): Promise<string> {
  const jar = await cookies();
  let token = jar.get(VISITOR_COOKIE)?.value;
  if (!token) {
    token = newToken(24);
    jar.set(VISITOR_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    });
  }
  return hashToken(token);
}
