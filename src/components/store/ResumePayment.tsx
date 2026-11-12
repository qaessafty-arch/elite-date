'use client';

import { useState, useTransition } from 'react';
import { resumePaymentAction } from '@/app/actions/checkout';

export function ResumePayment({ number, accessKey }: { number: string; accessKey: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await resumePaymentAction(number, accessKey);
            if (res.ok && res.url) window.location.assign(res.url);
            else setError(res.message ?? 'Something went wrong.');
          })
        }
      >
        {pending ? 'Opening payment…' : 'Complete payment'}
      </button>
      {error && (
        <p className="field-error mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
