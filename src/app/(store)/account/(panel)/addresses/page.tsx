import type { Metadata } from 'next';
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction } from '@/app/actions/account';
import { ActionForm, type FieldSpec } from '@/components/ActionForm';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { COUNTRY_NAMES, getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Your addresses', robots: { index: false } };

type Row = {
  id: string; label: string; first_name: string; last_name: string; line1: string; line2: string | null; city: string;
  region: string | null; postal_code: string; country: string; phone: string | null; is_default: boolean;
};

function fields(user: { firstName: string; lastName: string }, countries: string[], a?: Row): FieldSpec[] {
  return [
    { name: 'label', label: 'Address name', defaultValue: a?.label ?? 'Home' },
    { name: 'firstName', label: 'First name', defaultValue: a?.first_name ?? user.firstName, autoComplete: 'given-name', half: true },
    { name: 'lastName', label: 'Last name', defaultValue: a?.last_name ?? user.lastName, autoComplete: 'family-name', half: true },
    { name: 'line1', label: 'Street address', defaultValue: a?.line1, autoComplete: 'address-line1' },
    { name: 'line2', label: 'Apartment, suite, floor', defaultValue: a?.line2 ?? '', required: false, autoComplete: 'address-line2' },
    { name: 'city', label: 'City', defaultValue: a?.city, half: true, autoComplete: 'address-level2' },
    { name: 'region', label: 'State or region', defaultValue: a?.region ?? '', required: false, half: true, autoComplete: 'address-level1' },
    { name: 'postalCode', label: 'Postal code', defaultValue: a?.postal_code, half: true, autoComplete: 'postal-code' },
    { name: 'country', label: 'Country', defaultValue: a?.country ?? countries[0], half: true, options: countries.map((c) => ({ value: c, label: COUNTRY_NAMES[c] ?? c })) },
    { name: 'phone', label: 'Phone', type: 'tel', defaultValue: a?.phone ?? '', required: false, autoComplete: 'tel' },
    { name: 'isDefault', label: 'Use as my default address', checkbox: true, defaultChecked: a?.is_default },
  ];
}

export default async function AddressesPage() {
  const user = await requireUser('/account/addresses');
  const [rows, settings] = await Promise.all([
    query<Row>('select * from addresses where user_id = $1 order by is_default desc, created_at', [user.id]),
    getSettings(),
  ]);
  const countries = settings.shipping.countries;
  return (
    <>
      <h1 className="display display-lg">Addresses</h1>
      <ul className="mt-8 grid gap-5 lg:grid-cols-2">
        {rows.map((a) => (
          <li key={a.id} className="border border-line bg-paper p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{a.label}</h2>
              {a.is_default && <span className="tag bg-sand">Default</span>}
            </div>
            <address className="mt-2 not-italic text-mute">
              {a.first_name} {a.last_name}
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}
              <br />
              {a.city}
              {a.region ? `, ${a.region}` : ''} {a.postal_code}
              <br />
              {COUNTRY_NAMES[a.country] ?? a.country}
            </address>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem]">
              {!a.is_default && (
                <form action={setDefaultAddressAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="underline underline-offset-4">
                    Make default
                  </button>
                </form>
              )}
              <form action={deleteAddressAction}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="text-danger underline underline-offset-4">
                  Remove<span className="sr-only"> {a.label}</span>
                </button>
              </form>
            </div>
            <details className="mt-4 border-t border-line pt-3">
              <summary className="font-medium underline underline-offset-4">Edit this address</summary>
              <div className="mt-4">
                <ActionForm action={saveAddressAction} hidden={{ id: a.id }} submitLabel="Save address" fields={fields(user, countries, a)} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <section className="mt-10 max-w-2xl border-t border-ink pt-6">
        <h2 className="display display-md">Add an address</h2>
        <div className="mt-5">
          <ActionForm action={saveAddressAction} submitLabel="Add address" resetOnSuccess fields={fields(user, countries)} />
        </div>
      </section>
    </>
  );
}
