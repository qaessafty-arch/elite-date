import { deleteCouponAction, saveCouponAction } from '@/app/admin/actions';
import { ActionForm, type FieldSpec } from '@/components/ActionForm';
import { PageHeader, Panel, Status } from '@/components/admin/parts';
import { ConfirmButton } from '@/components/admin/ui';
import { adminCoupons } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Promotions' };

type Coupon = Awaited<ReturnType<typeof adminCoupons>>[number];
const dateValue = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

function fields(c?: Coupon): FieldSpec[] {
  return [
    { name: 'code', label: 'Code', defaultValue: c?.code, half: true, placeholder: 'WELCOME10' },
    { name: 'campaign', label: 'Campaign', defaultValue: c?.campaign, required: false, half: true, hint: 'Groups codes, e.g. Low Sun.' },
    { name: 'description', label: 'Description shown to customers', defaultValue: c?.description, required: false },
    { name: 'kind', label: 'Discount type', defaultValue: c?.kind ?? 'percent', half: true, options: [{ value: 'percent', label: 'Percentage off' }, { value: 'fixed', label: 'Fixed amount off' }] },
    { name: 'value', label: 'Value', defaultValue: c ? (c.kind === 'percent' ? String(c.value) : (c.value / 100).toFixed(2)) : '', half: true, hint: 'A percentage (10) or an amount (25.00).' },
    { name: 'minSubtotal', label: 'Minimum subtotal', defaultValue: c && c.min_subtotal_cents ? (c.min_subtotal_cents / 100).toFixed(2) : '', required: false, half: true },
    { name: 'usageLimit', label: 'Usage limit', type: 'number', min: '1', defaultValue: c?.usage_limit ? String(c.usage_limit) : '', required: false, half: true, hint: 'Leave empty for unlimited.' },
    { name: 'startsAt', label: 'Starts', type: 'date', defaultValue: dateValue(c?.starts_at ?? null), required: false, half: true },
    { name: 'expiresAt', label: 'Expires', type: 'date', defaultValue: dateValue(c?.expires_at ?? null), required: false, half: true },
    { name: 'active', label: 'Active', checkbox: true, defaultChecked: c ? c.is_active : true },
  ];
}

function state(c: Coupon): { value: string; label: string } {
  const now = new Date();
  if (!c.is_active) return { value: 'draft', label: 'Switched off' };
  if (c.expires_at && c.expires_at <= now) return { value: 'cancelled', label: 'Expired' };
  if (c.starts_at && c.starts_at > now) return { value: 'pending', label: 'Scheduled' };
  if (c.usage_limit !== null && c.used_count >= c.usage_limit) return { value: 'cancelled', label: 'Used up' };
  return { value: 'active', label: 'Live' };
}

export default async function PromotionsPage() {
  await requireAdmin('promotions.manage');
  const [coupons, settings] = await Promise.all([adminCoupons(), getSettings()]);
  const money = (c: number) => formatMoney(c, settings.locale.currency, settings.locale.locale);
  const campaigns = [...new Set(coupons.map((c) => c.campaign || 'No campaign'))];
  return (
    <>
      <PageHeader title="Promotions" description="Promo codes customers enter in their bag. Discounts are always recalculated on the server at checkout." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-6">
          {coupons.length === 0 && <Panel><p className="text-mute">No promo codes yet. Create the first one.</p></Panel>}
          {campaigns.map((campaign) => (
            <Panel key={campaign} title={campaign}>
              <ul>
                {coupons.filter((c) => (c.campaign || 'No campaign') === campaign).map((c) => {
                  const s = state(c);
                  return (
                    <li key={c.id} className="border-b border-line py-1 last:border-0">
                      <details>
                        <summary className="flex flex-wrap items-center justify-between gap-3 py-2">
                          <span>
                            <span className="font-semibold tracking-wide">{c.code}</span>
                            <span className="small block text-mute">
                              {c.kind === 'percent' ? `${c.value}% off` : `${money(c.value)} off`}
                              {c.min_subtotal_cents > 0 && `, over ${money(c.min_subtotal_cents)}`}
                              {c.expires_at && `, until ${c.expires_at.toLocaleDateString(settings.locale.locale, { dateStyle: 'medium' })}`}
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="small text-mute">Used {c.used_count}{c.usage_limit ? ` of ${c.usage_limit}` : ''}</span>
                            <Status value={s.value} label={s.label} />
                            <span className="small underline underline-offset-4">Edit</span>
                          </span>
                        </summary>
                        <div className="pb-5 pt-3">
                          <ActionForm action={saveCouponAction} hidden={{ id: c.id }} submitLabel="Save coupon" fields={fields(c)} />
                          <form action={deleteCouponAction} className="mt-3">
                            <input type="hidden" name="id" value={c.id} />
                            <ConfirmButton message={`Delete the code ${c.code}?`}>Delete coupon</ConfirmButton>
                          </form>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
        <Panel title="Create a coupon" className="self-start">
          <ActionForm action={saveCouponAction} submitLabel="Create coupon" resetOnSuccess fields={fields()} />
        </Panel>
      </div>
    </>
  );
}
