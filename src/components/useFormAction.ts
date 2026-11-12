'use client';

import { startTransition, useActionState } from 'react';

/**
 * useActionState, but submitted through onSubmit so React does not clear the
 * form afterwards. People keep what they typed when the server reports an error.
 */
export function useFormAction<S>(action: (prev: Awaited<S>, formData: FormData) => S | Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, pending, onSubmit };
}
