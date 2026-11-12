import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginAction, logoutAction } from '@/app/actions/auth';
import { ActionForm } from '@/components/ActionForm';
import { can, getCurrentUser } from '@/lib/auth';

export const metadata = { title: 'Sign in' };

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user && can(user, 'dashboard.view')) redirect('/admin');
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center px-5 py-12">
      <p className="display text-2xl uppercase tracking-[0.14em]">Admin</p>
      <h1 className="display display-md mt-6">Sign in to the store admin</h1>
      {user ? (
        <div className="mt-6">
          <p className="notice notice-error" role="alert">
            {user.email} does not have access to the admin area.
          </p>
          <form action={logoutAction} className="mt-5">
            <button type="submit" className="btn btn-secondary">
              Sign out and use another account
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-6">
          <ActionForm
            action={loginAction}
            hidden={{ next: '/admin' }}
            submitLabel="Sign in"
            pendingLabel="Signing in…"
            fields={[
              { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
              { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
            ]}
          />
        </div>
      )}
      <Link href="/" className="link mt-8">
        Back to the store
      </Link>
    </main>
  );
}
