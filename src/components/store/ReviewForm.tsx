'use client';

import { useActionState, useState } from 'react';
import { submitReviewAction } from '@/app/actions/catalog';

export function ReviewForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(submitReviewAction, null);
  const [rating, setRating] = useState(5);
  if (state?.ok)
    return (
      <p role="status" className="notice notice-ok">
        {state.message}
      </p>
    );
  return (
    <form action={action} className="grid max-w-lg gap-4">
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="label mb-2">Your rating</legend>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
              <span className="grid h-10 w-10 place-items-center rounded-[2px] border border-line-strong text-sm font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bone peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brass">
                {n}
                <span className="sr-only"> out of 5</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Headline</span>
        <input name="title" className="input" maxLength={80} required />
      </label>
      <label className="field">
        <span>Your review</span>
        <textarea name="body" className="input min-h-28" maxLength={1500} required />
      </label>
      {state && !state.ok && (
        <p role="alert" className="field-error">
          {state.message}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Posting…' : 'Post review'}
        </button>
      </div>
    </form>
  );
}
