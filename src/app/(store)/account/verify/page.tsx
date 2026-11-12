import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyEmailToken } from '@/app/actions/auth';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false }, referrer: 'no-referrer' };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const ok = token ? await verifyEmailToken(token) : false;
  return (
    <div className="shell max-w-xl pb-10 pt-10 md:pt-16">
      <h1 className="display display-lg">{ok ? 'Email confirmed' : 'This link did not work'}</h1>
      <p className="lede mt-3">
        {ok
          ? 'Thank you. Your email address is confirmed.'
          : 'The confirmation link has expired or was already used. Sign in and request a new one from your account.'}
      </p>
      <Link href="/account" className="btn btn-primary mt-7">
        Go to your account
      </Link>
    </div>
  );
}
