'use client';

import { useState, useTransition } from 'react';
import { resendVerificationAction } from '@/app/actions/auth';

export function ResendVerification() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <p className="mt-2">
      {message ? (
        <span role="status">{message}</span>
      ) : (
        <button type="button" className="underline underline-offset-4" disabled={pending} onClick={() => start(async () => setMessage((await resendVerificationAction())?.message ?? null))}>
          {pending ? 'Sending…' : 'Send the link again'}
        </button>
      )}
    </p>
  );
}
