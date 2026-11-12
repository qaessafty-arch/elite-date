import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';
import { AccountNav } from '@/components/store/AccountNav';
import { can, requireUser } from '@/lib/auth';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/account');
  return (
    <div className="shell grid gap-10 pb-10 pt-8 md:grid-cols-[13rem_1fr] md:pt-12">
      <aside>
        <p className="small text-mute">Signed in as</p>
        <p className="truncate font-semibold">{user.firstName ? `${user.firstName} ${user.lastName}` : user.email}</p>
        <AccountNav />
        {can(user, 'dashboard.view') && (
          <Link href="/admin" className="mt-4 block text-[0.9375rem] text-brass-deep underline underline-offset-4">
            Open store admin
          </Link>
        )}
        <form action={logoutAction} className="mt-4">
          <button type="submit" className="text-[0.9375rem] underline underline-offset-4">
            Sign out
          </button>
        </form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
