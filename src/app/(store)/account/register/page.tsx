import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { registerAction } from '@/app/actions/auth';
import { ActionForm } from '@/components/ActionForm';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = sp.next?.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/account?welcome=1';
  if (await getCurrentUser()) redirect('/account');
  return (
    <div className="shell max-w-xl pb-10 pt-10 md:pt-16">
      <h1 className="display display-lg">Create an account</h1>
      <p className="lede mt-3">It takes a minute. We will email you a link to confirm your address.</p>
      <div className="mt-7">
        <ActionForm
          action={registerAction}
          hidden={{ next }}
          submitLabel="Create account"
          pendingLabel="Creating your account…"
          fields={[
            { name: 'firstName', label: 'First name', autoComplete: 'given-name', half: true },
            { name: 'lastName', label: 'Last name', autoComplete: 'family-name', half: true },
            { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
            { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 10 characters, with a letter and a number.' },
            { name: 'marketing', label: 'Email me about new pieces and restocks', checkbox: true },
          ]}
        >
          <p className="small text-mute">
            By creating an account you agree to our{' '}
            <Link href="/help/terms" className="link">
              terms
            </Link>{' '}
            and{' '}
            <Link href="/help/privacy" className="link">
              privacy policy
            </Link>
            .
          </p>
        </ActionForm>
      </div>
      <p className="mt-6">
        Already have an account?{' '}
        <Link href="/account/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
