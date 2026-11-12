import { deleteShippingMethodAction, saveRolePermissionsAction, saveSettingsAction, saveShippingMethodAction } from '@/app/admin/actions';
import { ActionForm, type FieldSpec } from '@/components/ActionForm';
import { PageHeader, Panel, Status } from '@/components/admin/parts';
import { ConfirmButton, RowForm } from '@/components/admin/ui';
import { adminRoles, adminShippingMethods } from '@/lib/admin';
import { can, requireAdmin } from '@/lib/auth';
import { demoPaymentsAllowed } from '@/lib/payments';
import { PERMISSION_LABELS, PERMISSIONS } from '@/lib/permissions';
import { COUNTRY_NAMES, getSettings } from '@/lib/settings';

export const metadata = { title: 'Settings' };

type Method = Awaited<ReturnType<typeof adminShippingMethods>>[number];

function methodFields(m?: Method): FieldSpec[] {
  return [
    { name: 'name', label: 'Name', defaultValue: m?.name, half: true },
    { name: 'price', label: 'Price', defaultValue: m ? (m.price_cents / 100).toFixed(2) : '', half: true },
    { name: 'description', label: 'Description', defaultValue: m?.description, required: false },
    { name: 'freeOver', label: 'Free when the order is over', defaultValue: m?.free_over_cents != null ? (m.free_over_cents / 100).toFixed(2) : '', required: false, half: true, hint: 'Leave empty to always charge.' },
    { name: 'sortOrder', label: 'Position', type: 'number', min: '0', defaultValue: String(m?.sort_order ?? 0), half: true },
    { name: 'minDays', label: 'Fastest delivery, days', type: 'number', min: '0', defaultValue: String(m?.min_days ?? 2), half: true },
    { name: 'maxDays', label: 'Slowest delivery, days', type: 'number', min: '0', defaultValue: String(m?.max_days ?? 5), half: true },
    { name: 'active', label: 'Offer at checkout', checkbox: true, defaultChecked: m ? m.is_active : true },
  ];
}

export default async function SettingsPage() {
  const user = await requireAdmin('settings.manage');
  const [s, methods, roles] = await Promise.all([getSettings(), adminShippingMethods(), adminRoles()]);
  const stripeKey = !!process.env.STRIPE_SECRET_KEY;
  const stripeHook = !!process.env.STRIPE_WEBHOOK_SECRET;

  return (
    <>
      <PageHeader title="Settings" description="Changes apply to the store straight away." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Brand">
          <ActionForm
            action={saveSettingsAction}
            hidden={{ section: 'brand' }}
            submitLabel="Save brand"
            fields={[
              { name: 'name', label: 'Store name', defaultValue: s.brand.name, half: true },
              { name: 'tagline', label: 'Tagline', defaultValue: s.brand.tagline, required: false, half: true },
              { name: 'description', label: 'Short description', defaultValue: s.brand.description, required: false, textarea: true },
              { name: 'logoUrl', label: 'Logo image URL', defaultValue: s.brand.logoUrl ?? '', required: false, hint: 'Optional. The name is set in type when empty.' },
            ]}
          />
        </Panel>

        <Panel title="Announcement bar">
          <ActionForm
            action={saveSettingsAction}
            hidden={{ section: 'announcement' }}
            submitLabel="Save announcements"
            fields={[
              { name: 'messages', label: 'Messages, one per line', defaultValue: s.announcement.messages.join('\n'), textarea: true, required: false },
              { name: 'enabled', label: 'Show the announcement bar', checkbox: true, defaultChecked: s.announcement.enabled },
            ]}
          />
        </Panel>

        <Panel title="Currency and language">
          <ActionForm
            action={saveSettingsAction}
            hidden={{ section: 'locale' }}
            submitLabel="Save"
            fields={[
              { name: 'currency', label: 'Currency', defaultValue: s.locale.currency, half: true, options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SEK'].map((c) => ({ value: c, label: c })) },
              { name: 'locale', label: 'Number and date format', defaultValue: s.locale.locale, half: true, options: ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'sv-SE'].map((c) => ({ value: c, label: c })) },
            ]}
          >
            <p className="small text-mute">Changing currency relabels prices; it does not convert them.</p>
          </ActionForm>
        </Panel>

        <Panel title="Tax">
          <ActionForm
            action={saveSettingsAction}
            hidden={{ section: 'tax' }}
            submitLabel="Save tax"
            fields={[
              { name: 'ratePercent', label: 'Rate, percent', type: 'number', step: '0.01', min: '0', defaultValue: String(s.tax.ratePercent), half: true },
              { name: 'label', label: 'Label at checkout', defaultValue: s.tax.label, half: true },
            ]}
          />
        </Panel>

        <Panel title="Payments">
          <dl className="mb-5 grid gap-2 text-[0.9375rem]">
            <div className="flex items-center justify-between gap-3">
              <dt>Stripe secret key (STRIPE_SECRET_KEY)</dt>
              <dd><Status value={stripeKey ? 'active' : 'pending'} label={stripeKey ? 'Set' : 'Missing'} /></dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Stripe webhook secret (STRIPE_WEBHOOK_SECRET)</dt>
              <dd><Status value={stripeHook ? 'active' : 'pending'} label={stripeHook ? 'Set' : 'Missing'} /></dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Demo payments allowed in this environment</dt>
              <dd><Status value={demoPaymentsAllowed() ? 'pending' : 'draft'} label={demoPaymentsAllowed() ? 'Yes' : 'No'} /></dd>
            </div>
          </dl>
          <p className="small mb-4 text-mute">Keys are read from the server environment and are never shown or stored here. See the README for setup.</p>
          <ActionForm
            action={saveSettingsAction}
            hidden={{ section: 'payments' }}
            submitLabel="Save payment methods"
            fields={[
              { name: 'stripe', label: 'Offer card payments through Stripe', checkbox: true, defaultChecked: s.payments.stripe },
              { name: 'demo', label: 'Offer demo payments (no money moves)', checkbox: true, defaultChecked: s.payments.demo },
            ]}
          />
        </Panel>

        <Panel title="Store contact">
          <ActionForm
            action={saveSettingsAction}
            hidden={{ section: 'contact' }}
            submitLabel="Save contact details"
            fields={[
              { name: 'email', label: 'Email', type: 'email', defaultValue: s.contact.email, half: true },
              { name: 'phone', label: 'Phone', defaultValue: s.contact.phone, required: false, half: true },
              { name: 'address', label: 'Address', defaultValue: s.contact.address, required: false },
              { name: 'hours', label: 'Opening hours', defaultValue: s.contact.hours, required: false },
            ]}
          />
        </Panel>

        <Panel title="Social links">
          <ActionForm
            action={saveSettingsAction}
            hidden={{ section: 'social' }}
            submitLabel="Save links"
            fields={[
              { name: 'instagram', label: 'Instagram', type: 'url', defaultValue: s.social.instagram, required: false },
              { name: 'tiktok', label: 'TikTok', type: 'url', defaultValue: s.social.tiktok, required: false },
              { name: 'pinterest', label: 'Pinterest', type: 'url', defaultValue: s.social.pinterest, required: false },
            ]}
          />
        </Panel>

        <Panel title="Theme">
          <ActionForm
            action={saveSettingsAction}
            hidden={{ section: 'theme' }}
            submitLabel="Save theme"
            fields={[{ name: 'defaultTheme', label: 'Default theme for new visitors', defaultValue: s.theme.defaultTheme, options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] }]}
          >
            <p className="small text-mute">Visitors can switch theme in the footer; their choice is remembered on their device.</p>
          </ActionForm>
        </Panel>

        <Panel title="Shipping countries" className="xl:col-span-2">
          <ActionForm action={saveSettingsAction} hidden={{ section: 'shipping' }} submitLabel="Save countries" fields={[]}>
            <fieldset>
              <legend className="sr-only">Countries you ship to</legend>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
                {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                  <li key={code}>
                    <label className="flex cursor-pointer items-center gap-2.5 text-[0.9375rem]">
                      <input type="checkbox" name="countries" value={code} defaultChecked={s.shipping.countries.includes(code)} className="h-4 w-4 accent-[var(--ink)]" />
                      {name}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          </ActionForm>
        </Panel>

        <Panel title="Delivery methods" className="xl:col-span-2">
          <div className="grid gap-6 xl:grid-cols-2">
            <ul>
              {methods.map((m) => (
                <li key={m.id} className="border-b border-line py-1">
                  <details>
                    <summary className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <span>
                        <span className="font-semibold">{m.name}</span>
                        <span className="small block text-mute">
                          ${(m.price_cents / 100).toFixed(2)}, {m.min_days} to {m.max_days} days{m.free_over_cents != null ? `, free over $${(m.free_over_cents / 100).toFixed(0)}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <Status value={m.is_active ? 'active' : 'draft'} label={m.is_active ? 'Offered' : 'Off'} />
                        <span className="small underline underline-offset-4">Edit</span>
                      </span>
                    </summary>
                    <div className="pb-5 pt-3">
                      <ActionForm action={saveShippingMethodAction} hidden={{ id: m.id }} submitLabel="Save method" fields={methodFields(m)} />
                      <form action={deleteShippingMethodAction} className="mt-3">
                        <input type="hidden" name="id" value={m.id} />
                        <ConfirmButton message={`Delete the ${m.name} delivery method?`}>Delete method</ConfirmButton>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            <div>
              <h3 className="label mb-3">Add a delivery method</h3>
              <ActionForm action={saveShippingMethodAction} submitLabel="Add method" resetOnSuccess fields={methodFields()} />
            </div>
          </div>
        </Panel>

        {can(user, 'roles.manage') && (
          <Panel title="Roles and permissions" className="xl:col-span-2">
            <div className="grid gap-6 lg:grid-cols-3">
              {roles.map((r) => (
                <div key={r.id}>
                  <h3 className="font-semibold">{r.name}</h3>
                  <p className="small mb-3 text-mute">
                    {r.users} {r.users === 1 ? 'account' : 'accounts'}
                  </p>
                  {r.key === 'customer' ? (
                    <p className="small text-mute">Customers never have admin permissions.</p>
                  ) : (
                    <RowForm action={saveRolePermissionsAction} hidden={{ roleId: String(r.id) }} label="Save permissions" className="grid gap-1.5">
                      {PERMISSIONS.map((p) => {
                        const locked = r.key === 'admin' && ['dashboard.view', 'roles.manage', 'settings.manage'].includes(p);
                        return (
                          <label key={p} className="flex cursor-pointer items-center gap-2.5 text-[0.9375rem]">
                            <input type="checkbox" name="permissions" value={p} defaultChecked={r.permissions.includes(p)} disabled={locked} className="h-4 w-4 accent-[var(--ink)]" />
                            {PERMISSION_LABELS[p]}
                            {locked && <span className="small text-mute">(always on)</span>}
                          </label>
                        );
                      })}
                    </RowForm>
                  )}
                </div>
              ))}
            </div>
            <p className="small mt-5 text-mute">Assign a role to a person from their page under Customers.</p>
          </Panel>
        )}
      </div>
    </>
  );
}
