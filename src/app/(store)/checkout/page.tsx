import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckoutFlow } from '@/components/store/CheckoutFlow';
import { getCurrentUser } from '@/lib/auth';
import { getCartView } from '@/lib/cart';
import { query } from '@/lib/db';
import { listShippingMethods } from '@/lib/orders';
import { availableProviders, demoPaymentsAllowed } from '@/lib/payments';
import { COUNTRY_NAMES, getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const [cart, user, settings, methods] = await Promise.all([getCartView(), getCurrentUser(), getSettings(), listShippingMethods()]);
  if (!cart.lines.length) redirect('/cart');

  const addresses = user
    ? await query<{
        id: string; label: string; first_name: string; last_name: string; line1: string; line2: string | null;
        city: string; region: string | null; postal_code: string; country: string; phone: string | null; is_default: boolean;
      }>('select * from addresses where user_id = $1 order by is_default desc, created_at desc', [user.id])
    : [];
  const def = addresses.find((a) => a.is_default && settings.shipping.countries.includes(a.country));
  const providers = availableProviders(settings);

  return (
    <div className="shell pb-10 pt-8 md:pt-12">
      <h1 className="display display-lg">Checkout</h1>
      {providers.some((p) => p.id === 'demo') && demoPaymentsAllowed() && (
        <p className="notice mt-5 max-w-3xl">
          This store is running in demo mode. Orders placed with “Demo payment” are recorded as paid, and no money moves.
        </p>
      )}
      <div className="mt-8">
        <CheckoutFlow
          methods={methods.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            priceCents: m.price_cents,
            freeOverCents: m.free_over_cents,
            days: m.min_days === m.max_days ? String(m.min_days) : `${m.min_days} to ${m.max_days}`,
          }))}
          providers={providers}
          countries={settings.shipping.countries.map((code) => ({ code, name: COUNTRY_NAMES[code] ?? code }))}
          signedIn={!!user}
          taxLabel={settings.tax.label}
          initialTotals={cart.totals}
          initial={{
            email: user?.email,
            firstName: user?.firstName || def?.first_name,
            lastName: user?.lastName || def?.last_name,
            phone: def?.phone ?? undefined,
            line1: def?.line1,
            line2: def?.line2 ?? undefined,
            city: def?.city,
            region: def?.region ?? undefined,
            postalCode: def?.postal_code,
            ...(def ? { country: def.country } : {}),
          }}
          savedAddresses={addresses
            .filter((a) => settings.shipping.countries.includes(a.country))
            .map((a) => ({
              id: a.id, label: a.label, firstName: a.first_name, lastName: a.last_name, line1: a.line1, line2: a.line2 ?? '',
              city: a.city, region: a.region ?? '', postalCode: a.postal_code, country: a.country, phone: a.phone ?? '',
            }))}
        />
      </div>
    </div>
  );
}
