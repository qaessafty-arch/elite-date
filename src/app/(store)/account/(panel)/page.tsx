import type { Metadata } from 'next';
import Link from 'next/link';
import { ResendVerification } from '@/components/store/ResendVerification';
import { requireUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { listOrdersForUser, ORDER_STATUS_LABEL } from '@/lib/orders';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser('/account');
  const [orders, address, settings, sp] = await Promise.all([
    listOrdersForUser(user.id),
    queryOne<{ line1: string; city: string; postal_code: string }>('select line1, city, postal_code from addresses where user_id = $1 and is_default', [user.id]),
    getSettings(),
    searchParams,
  ]);
  const latest = orders[0];
  return (
    <>
      <h1 className="display display-lg">{sp.welcome ? `Welcome, ${user.firstName}` : `Hello, ${user.firstName || 'there'}`}</h1>
      {!user.emailVerified && (
        <div className="notice mt-6">
          <p>
            Confirm your email address. We sent a link to <strong className="font-semibold">{user.email}</strong>.
          </p>
          <ResendVerification />
        </div>
      )}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <section className="border border-line bg-paper p-5">
          <h2 className="display display-sm">Latest order</h2>
          {latest ? (
            <>
              <p className="mt-2 font-semibold">{latest.number}</p>
              <p className="text-mute">
                {ORDER_STATUS_LABEL[latest.status]}, {formatMoney(latest.totalCents, latest.currency, settings.locale.locale)}
              </p>
              <Link href={`/orders/${latest.number}`} className="link mt-3 inline-block">
                View order
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-mute">You have not ordered yet.</p>
              <Link href="/c/new-arrivals" className="link mt-3 inline-block">
                Shop new arrivals
              </Link>
            </>
          )}
        </section>
        <section className="border border-line bg-paper p-5">
          <h2 className="display display-sm">Default address</h2>
          {address ? (
            <p className="mt-2 text-mute">
              {address.line1}, {address.city} {address.postal_code}
            </p>
          ) : (
            <p className="mt-2 text-mute">No address saved yet.</p>
          )}
          <Link href="/account/addresses" className="link mt-3 inline-block">
            Manage addresses
          </Link>
        </section>
      </div>
    </>
  );
}
