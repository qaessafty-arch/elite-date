'use client';

import { useActionState } from 'react';
import { trackOrderAction } from '@/app/actions/checkout';

const STEPS = ['confirmed', 'processing', 'shipped', 'delivered'];
const LABELS: Record<string, string> = { confirmed: 'Confirmed', processing: 'Being prepared', shipped: 'Shipped', delivered: 'Delivered' };

export function TrackForm() {
  const [state, action, pending] = useActionState(trackOrderAction, null);
  const reached = state?.order ? STEPS.indexOf(state.order.status) : -1;
  return (
    <>
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="field">
          <span>Order number</span>
          <input name="number" className="input uppercase placeholder:normal-case" placeholder="HD-XXXXXXXX" required maxLength={20} autoComplete="off" />
        </label>
        <label className="field">
          <span>Email used for the order</span>
          <input name="email" type="email" className="input" required autoComplete="email" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Looking…' : 'Find order'}
        </button>
      </form>
      <div aria-live="polite" className="mt-8">
        {state && !state.ok && <p className="notice notice-error">{state.message}</p>}
        {state?.order && (
          <div className="border border-line bg-paper p-6">
            <p className="small text-mute">Placed {state.order.placed}</p>
            <h2 className="display display-md mt-1">Order {state.order.number}</h2>
            <p className="mt-2 font-semibold">{state.order.statusLabel}</p>
            {state.order.status !== 'cancelled' && state.order.status !== 'pending' && (
              <ol className="mt-5 grid grid-cols-4 gap-1">
                {STEPS.map((s, i) => (
                  <li key={s} className={`border-t-2 pt-2 text-sm ${i <= reached ? 'border-ink font-semibold' : 'border-line text-mute'}`}>
                    {LABELS[s]}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-5 text-mute">
              {state.order.tracking
                ? `${state.order.carrier ?? 'Carrier'} tracking number ${state.order.tracking}`
                : `Sent by ${state.order.method.toLowerCase()} delivery. A tracking number appears here once the parcel leaves us.`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
