import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';
import { ActionForm } from '@/components/ActionForm';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const next = sp.next?.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/account';
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="shell grid max-w-5xl gap-12 pb-10 pt-10 md:grid-cols-2 md:pt-16">
      <div>
        <h1 className="display display-lg">Sign in</h1>
        {sp.reset === '1' && (
          <p className="notice notice-ok mt-5" role="status">
            Your password has been changed. Sign in with the new one.
          </p>
        )}
        <div className="mt-7">
          <ActionForm
            action={loginAction}
            hidden={{ next }}
            submitLabel="Sign in"
            pendingLabel="Signing in…"
            fields={[
              { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
              { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
            ]}
          />
        </div>
        <p className="mt-5">
          <Link href="/account/forgot-password" className="link">
            Forgot your password?
          </Link>
        </p>
      </div>
      <div className="border-t border-line pt-8 md:border-l md:border-t-0 md:pl-12 md:pt-0">
        <h2 className="display display-md">New here?</h2>
        <p className="mt-3 text-mute">An account keeps your orders, addresses and wishlist in one place, and makes checkout faster.</p>
        <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="btn btn-secondary mt-6">
          Create an account
        </Link>
      </div>
    </div>
  );
}
