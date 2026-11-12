import type { Metadata } from 'next';
import Link from 'next/link';
import { resetPasswordAction } from '@/app/actions/auth';
import { ActionForm } from '@/components/ActionForm';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false }, referrer: 'no-referrer' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="shell max-w-xl pb-10 pt-10 md:pt-16">
      <h1 className="display display-lg">Choose a new password</h1>
      {!token ? (
        <p className="notice notice-error mt-6">
          This link is missing its token.{' '}
          <Link href="/account/forgot-password" className="link">
            Request a new reset link
          </Link>
          .
        </p>
      ) : (
        <div className="mt-7">
          <ActionForm
            action={resetPasswordAction}
            hidden={{ token }}
            submitLabel="Save new password"
            fields={[{ name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password', hint: 'At least 10 characters, with a letter and a number.' }]}
          />
        </div>
      )}
    </div>
  );
}
