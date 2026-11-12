import type { Metadata } from 'next';
import Link from 'next/link';
import { requestPasswordResetAction } from '@/app/actions/auth';
import { ActionForm } from '@/components/ActionForm';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="shell max-w-xl pb-10 pt-10 md:pt-16">
      <h1 className="display display-lg">Reset your password</h1>
      <p className="lede mt-3">Enter the email you signed up with and we will send a link to choose a new password.</p>
      <div className="mt-7">
        <ActionForm
          action={requestPasswordResetAction}
          submitLabel="Email me a reset link"
          pendingLabel="Sending…"
          fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]}
        />
      </div>
      <p className="mt-6">
        <Link href="/account/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
