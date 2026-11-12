'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { placeOrderAction, quoteCheckoutAction } from '@/app/actions/checkout';
import { addressSchema, contactSchema, zodFieldErrors, type CheckoutValues } from '@/lib/checkout-schema';
import type { Totals } from '@/lib/totals';
import { Icon } from '../Icon';
import { useStore } from './StoreProvider';

type Method = { id: string; name: string; description: string; priceCents: number; freeOverCents: number | null; days: string };
type Provider = { id: 'stripe' | 'demo'; label: string; description: string };
type Address = { id: string; label: string; firstName: string; lastName: string; line1: string; line2: string; city: string; region: string; postalCode: string; country: string; phone: string };

const STEPS = ['Contact', 'Address', 'Delivery', 'Payment'] as const;

export function CheckoutFlow({
  methods,
  providers,
  countries,
  initial,
  savedAddresses,
  signedIn,
  taxLabel,
  initialTotals,
}: {
  methods: Method[];
  providers: Provider[];
  countries: { code: string; name: string }[];
  initial: Partial<CheckoutValues>;
  savedAddresses: Address[];
  signedIn: boolean;
  taxLabel: string;
  initialTotals: Totals;
}) {
  const { cart, money } = useStore();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Partial<CheckoutValues>>({
    country: countries[0]?.code,
    shippingMethodId: methods[0]?.id,
    provider: providers[0]?.id,
    saveAddress: signedIn,
    ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals>(initialTotals);
  const [placing, startPlacing] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const set = (patch: Partial<CheckoutValues>) => setValues((v) => ({ ...v, ...patch }));

  // Totals always come from the server; the browser only displays them.
  useEffect(() => {
    let live = true;
    quoteCheckoutAction(values.shippingMethodId ?? null).then((t) => live && t && setTotals(t));
    return () => {
      live = false;
    };
  }, [values.shippingMethodId, cart]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step]);

  const validate = (index: number): boolean => {
    let result: Record<string, string> = {};
    if (index === 0) {
      const r = contactSchema.safeParse({ email: values.email ?? '', firstName: values.firstName ?? '', lastName: values.lastName ?? '', phone: values.phone ?? '' });
      if (!r.success) result = zodFieldErrors(r.error);
    } else if (index === 1) {
      const r = addressSchema.safeParse({ line1: values.line1 ?? '', line2: values.line2 ?? '', city: values.city ?? '', region: values.region ?? '', postalCode: values.postalCode ?? '', country: values.country ?? '' });
      if (!r.success) result = zodFieldErrors(r.error);
    } else if (index === 2 && !values.shippingMethodId) result = { shippingMethodId: 'Choose a delivery method.' };
    else if (index === 3 && !values.provider) result = { provider: 'Choose how you want to pay.' };
    setErrors(result);
    const firstKey = Object.keys(result)[0];
    if (firstKey) document.getElementById(`co-${firstKey}`)?.focus();
    return !firstKey;
  };

  const next = () => {
    if (validate(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const place = () => {
    for (let i = 0; i < STEPS.length; i++) {
      if (!validate(i)) {
        setStep(i);
        return;
      }
    }
    setFormError(null);
    startPlacing(async () => {
      const res = await placeOrderAction(values);
      if (res.ok) {
        window.location.assign(res.redirectTo);
        return;
      }
      setFormError(res.message);
      if (res.fields) {
        setErrors(res.fields);
        const key = Object.keys(res.fields)[0];
        setStep(['email', 'firstName', 'lastName', 'phone'].includes(key) ? 0 : key === 'shippingMethodId' ? 2 : key === 'provider' ? 3 : 1);
      }
    });
  };

  const text = (name: keyof CheckoutValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, optional = false) => (
    <label className="field">
      <span>
        {label}
        {optional && <span className="font-normal text-mute"> (optional)</span>}
      </span>
      <input
        id={`co-${name}`}
        name={name}
        className="input"
        value={(values[name] as string) ?? ''}
        onChange={(e) => set({ [name]: e.target.value } as Partial<CheckoutValues>)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `co-${name}-err` : undefined}
        required={!optional}
        {...props}
      />
      {errors[name] && (
        <span id={`co-${name}-err`} className="field-error font-normal" role="alert">
          {errors[name]}
        </span>
      )}
    </label>
  );

  const method = methods.find((m) => m.id === values.shippingMethodId);
  const summaryFor = (i: number) =>
    i === 0
      ? `${values.firstName ?? ''} ${values.lastName ?? ''}, ${values.email ?? ''}`
      : i === 1
        ? [values.line1, values.city, values.postalCode, countries.find((c) => c.code === values.country)?.name].filter(Boolean).join(', ')
        : i === 2
          ? method?.name
          : null;

  const blocked = cart.lines.some((l) => l.available < l.quantity);

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <ol className="mb-8 flex gap-1 text-sm" aria-label="Checkout steps">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                className={`block w-full border-t-2 pt-2 text-left font-medium ${i === step ? 'border-ink' : i < step ? 'border-brass text-mute hover:text-ink' : 'border-line text-mute/70'}`}
              >
                <span className="tabular-nums">{i + 1}.</span> {s}
                {i < step && <span className="sr-only"> (done, edit)</span>}
              </button>
            </li>
          ))}
        </ol>

        {STEPS.slice(0, step).map((s, i) => (
          <div key={s} className="flex items-start justify-between gap-4 border-b border-line py-3 text-[0.9375rem]">
            <p className="min-w-0">
              <span className="font-semibold">{s}</span>
              <span className="mt-0.5 block truncate text-mute">{summaryFor(i)}</span>
            </p>
            <button type="button" className="shrink-0 underline underline-offset-4" onClick={() => setStep(i)}>
              Edit<span className="sr-only"> {s.toLowerCase()}</span>
            </button>
          </div>
        ))}

        <form
          className="pt-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step === STEPS.length - 1) place();
            else next();
          }}
        >
          <h2 ref={heading} tabIndex={-1} className="display display-md outline-none">
            {step === 0 && 'Who is this order for?'}
            {step === 1 && 'Where should we send it?'}
            {step === 2 && 'How fast do you need it?'}
            {step === 3 && 'Review and pay'}
          </h2>

          {step === 0 && (
            <div className="mt-6 grid gap-4">
              {!signedIn && (
                <p className="small text-mute">
                  Checking out as a guest.{' '}
                  <Link href="/account/login?next=/checkout" className="link text-ink">
                    Sign in
                  </Link>{' '}
                  to use saved addresses and see this order in your account.
                </p>
              )}
              {text('email', 'Email', { type: 'email', autoComplete: 'email', inputMode: 'email' })}
              <div className="grid gap-4 sm:grid-cols-2">
                {text('firstName', 'First name', { autoComplete: 'given-name' })}
                {text('lastName', 'Last name', { autoComplete: 'family-name' })}
              </div>
              {text('phone', 'Phone, for delivery updates', { type: 'tel', autoComplete: 'tel', inputMode: 'tel' }, true)}
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 grid gap-4">
              {savedAddresses.length > 0 && (
                <label className="field">
                  <span>Use a saved address</span>
                  <select
                    className="input"
                    defaultValue=""
                    onChange={(e) => {
                      const a = savedAddresses.find((x) => x.id === e.target.value);
                      if (a) set({ line1: a.line1, line2: a.line2, city: a.city, region: a.region, postalCode: a.postalCode, country: a.country, saveAddress: false });
                    }}
                  >
                    <option value="">Enter a new address</option>
                    {savedAddresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}: {a.line1}, {a.city}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {text('line1', 'Street address', { autoComplete: 'address-line1' })}
              {text('line2', 'Apartment, suite, floor', { autoComplete: 'address-line2' }, true)}
              <div className="grid gap-4 sm:grid-cols-2">
                {text('city', 'City', { autoComplete: 'address-level2' })}
                {text('region', 'State or region', { autoComplete: 'address-level1' }, true)}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {text('postalCode', 'Postal code', { autoComplete: 'postal-code' })}
                <label className="field">
                  <span>Country</span>
                  <select id="co-country" className="input" value={values.country ?? ''} onChange={(e) => set({ country: e.target.value })} autoComplete="country" aria-invalid={!!errors.country}>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.country && <span className="field-error font-normal">{errors.country}</span>}
                </label>
              </div>
              {signedIn && (
                <label className="flex cursor-pointer items-center gap-3 text-[0.9375rem]">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={!!values.saveAddress} onChange={(e) => set({ saveAddress: e.target.checked })} />
                  Save this address to my account
                </label>
              )}
            </div>
          )}

          {step === 2 && (
            <fieldset className="mt-6 grid gap-3">
              <legend className="sr-only">Delivery method</legend>
              {methods.map((m, i) => {
                const free = m.freeOverCents !== null && totals.subtotalCents - totals.discountCents >= m.freeOverCents;
                return (
                  <label key={m.id} className="flex cursor-pointer items-start gap-4 rounded-[2px] border border-line-strong bg-paper p-4 has-[:checked]:border-ink has-[:checked]:outline has-[:checked]:outline-1 has-[:checked]:outline-ink">
                    <input
                      id={i === 0 ? 'co-shippingMethodId' : undefined}
                      type="radio"
                      name="shippingMethodId"
                      className="mt-1 h-4 w-4 accent-[var(--ink)]"
                      checked={values.shippingMethodId === m.id}
                      onChange={() => set({ shippingMethodId: m.id })}
                    />
                    <span className="flex-1">
                      <span className="flex justify-between gap-4 font-semibold">
                        {m.name}
                        <span className="tabular-nums">{free ? 'Free' : money(m.priceCents)}</span>
                      </span>
                      <span className="small block text-mute">
                        {m.days} working days. {m.description}
                        {m.freeOverCents !== null && !free ? `. Free over ${money(m.freeOverCents)}` : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
              {errors.shippingMethodId && <p className="field-error">{errors.shippingMethodId}</p>}
            </fieldset>
          )}

          {step === 3 && (
            <div className="mt-6 grid gap-5">
              {providers.length === 0 ? (
                <p className="notice notice-error" role="alert">
                  Online payment is not set up for this store yet, so orders cannot be placed. Please contact us and we will help you order.
                </p>
              ) : (
                <fieldset className="grid gap-3">
                  <legend className="label mb-2">Payment method</legend>
                  {providers.map((p, i) => (
                    <label key={p.id} className="flex cursor-pointer items-start gap-4 rounded-[2px] border border-line-strong bg-paper p-4 has-[:checked]:border-ink has-[:checked]:outline has-[:checked]:outline-1 has-[:checked]:outline-ink">
                      <input id={i === 0 ? 'co-provider' : undefined} type="radio" name="provider" className="mt-1 h-4 w-4 accent-[var(--ink)]" checked={values.provider === p.id} onChange={() => set({ provider: p.id })} />
                      <span>
                        <span className="block font-semibold">{p.label}</span>
                        <span className="small block text-mute">{p.description}</span>
                      </span>
                    </label>
                  ))}
                  {errors.provider && <p className="field-error">{errors.provider}</p>}
                </fieldset>
              )}
              <p className="small text-mute">
                By placing this order you agree to our{' '}
                <Link href="/help/terms" className="link">
                  terms
                </Link>{' '}
                and{' '}
                <Link href="/help/privacy" className="link">
                  privacy policy
                </Link>
                .
              </p>
            </div>
          )}

          {formError && (
            <p className="notice notice-error mt-6" role="alert">
              {formError}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {step < STEPS.length - 1 ? (
              <button type="submit" className="btn btn-primary min-w-48">
                Continue to {STEPS[step + 1].toLowerCase()}
              </button>
            ) : (
              <button type="submit" className="btn btn-primary min-w-56" disabled={placing || blocked || providers.length === 0}>
                {placing ? 'Placing your order…' : values.provider === 'stripe' ? `Continue to payment, ${money(totals.totalCents)}` : `Place order, ${money(totals.totalCents)}`}
              </button>
            )}
            {step > 0 ? (
              <button type="button" className="underline underline-offset-4" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            ) : (
              <Link href="/cart" className="underline underline-offset-4">
                Back to bag
              </Link>
            )}
          </div>
          {blocked && <p className="field-error mt-3">Some items in your bag are no longer available in the quantity you chose. Go back to your bag to fix them.</p>}
        </form>
      </div>

      {/* Order summary */}
      <aside aria-labelledby="summary-heading" className="lg:col-span-5 lg:pl-6">
        <div className="border border-line bg-paper p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <h2 id="summary-heading" className="display display-sm">
            Order summary
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {cart.lines.map((l) => (
              <li key={l.id} className="flex gap-4 py-3">
                <span className="relative block h-20 w-16 shrink-0 overflow-hidden bg-sand">
                  {l.image && <Image src={l.image} alt="" fill sizes="64px" className="object-cover" />}
                  <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center bg-ink px-1 text-[0.6875rem] font-semibold text-bone">{l.quantity}</span>
                </span>
                <span className="min-w-0 flex-1 text-[0.9375rem]">
                  <span className="block font-medium">{l.name}</span>
                  <span className="small text-mute">
                    {l.color}, {l.size}
                    <span className="sr-only">, quantity {l.quantity}</span>
                  </span>
                </span>
                <span className="text-[0.9375rem] tabular-nums">{money(l.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid gap-1.5 border-t border-line pt-4 text-[0.9375rem]">
            <div className="flex justify-between">
              <dt className="text-mute">Subtotal</dt>
              <dd className="tabular-nums">{money(totals.subtotalCents)}</dd>
            </div>
            {totals.discountCents > 0 && (
              <div className="flex justify-between">
                <dt className="text-mute">Discount{cart.coupon ? ` (${cart.coupon.code})` : ''}</dt>
                <dd className="tabular-nums text-ok">−{money(totals.discountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-mute">Shipping{method ? `, ${method.name.toLowerCase()}` : ''}</dt>
              <dd className="tabular-nums">{totals.shippingCents === 0 ? 'Free' : money(totals.shippingCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-mute">{taxLabel}</dt>
              <dd className="tabular-nums">{money(totals.taxCents)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums" aria-live="polite">
                {money(totals.totalCents)}
              </dd>
            </div>
          </dl>
          <p className="small mt-4 flex items-center gap-2 text-mute">
            <Icon name="returns" size={16} /> Free returns within 30 days
          </p>
        </div>
      </aside>
    </div>
  );
}
