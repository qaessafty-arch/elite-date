'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { subscribeNewsletterAction } from '@/app/actions/cart';

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletterAction, null);

  if (state?.ok) {
    return (
      <p role="status" className="mt-6 max-w-md border-l-2 border-brass pl-4 font-medium">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="mt-6 max-w-md" noValidate>
      <label htmlFor="newsletter-email" className="label mb-2 block">
        Email address
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="name@example.com"
          aria-invalid={state ? !state.ok : undefined}
          aria-describedby="newsletter-help"
          className="min-h-12 w-full min-w-0 rounded-[2px] border border-white/30 bg-white/5 px-3.5 text-on-dark placeholder:text-on-dark/40 focus-visible:border-brass"
        />
        <button type="submit" className="btn btn-light shrink-0" disabled={pending}>
          {pending ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>
      <p id="newsletter-help" className="small mt-2 text-on-dark/60" role={state && !state.ok ? 'alert' : undefined}>
        {state && !state.ok ? (
          <span className="font-medium text-[#f0a89e]">{state.message}</span>
        ) : (
          <>
            Unsubscribe in one click, any time. See our{' '}
            <Link href="/help/privacy" className="underline underline-offset-2">
              privacy policy
            </Link>
            .
          </>
        )}
      </p>
    </form>
  );
}
