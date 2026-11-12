import type { Metadata } from 'next';
import { changePasswordAction, updateProfileAction } from '@/app/actions/account';
import { ActionForm } from '@/components/ActionForm';
import { requireUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';

export const metadata: Metadata = { title: 'Profile and password', robots: { index: false } };

export default async function SettingsPage() {
  const user = await requireUser('/account/settings');
  const profile = await queryOne<{ phone: string | null; marketing_opt_in: boolean }>('select phone, marketing_opt_in from profiles where user_id = $1', [user.id]);
  return (
    <>
      <h1 className="display display-lg">Profile and password</h1>
      <section className="mt-8 max-w-2xl">
        <h2 className="display display-md">Profile</h2>
        <p className="mt-1 text-mute">Signed in as {user.email}.</p>
        <div className="mt-5">
          <ActionForm
            action={updateProfileAction}
            submitLabel="Save profile"
            fields={[
              { name: 'firstName', label: 'First name', defaultValue: user.firstName, autoComplete: 'given-name', half: true },
              { name: 'lastName', label: 'Last name', defaultValue: user.lastName, autoComplete: 'family-name', half: true },
              { name: 'phone', label: 'Phone', type: 'tel', defaultValue: profile?.phone ?? '', required: false, autoComplete: 'tel' },
              { name: 'marketing', label: 'Email me about new pieces and restocks', checkbox: true, defaultChecked: profile?.marketing_opt_in },
            ]}
          />
        </div>
      </section>
      <section className="mt-12 max-w-2xl border-t border-line pt-8">
        <h2 className="display display-md">Password</h2>
        <div className="mt-5">
          <ActionForm
            action={changePasswordAction}
            submitLabel="Change password"
            resetOnSuccess
            fields={[
              { name: 'current', label: 'Current password', type: 'password', autoComplete: 'current-password' },
              { name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password', hint: 'At least 10 characters, with a letter and a number.' },
            ]}
          />
        </div>
      </section>
    </>
  );
}
