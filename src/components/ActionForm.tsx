'use client';

import { useActionState, useEffect, useRef } from 'react';

export type ActionState = { ok: boolean; message: string; fields?: Record<string, string> } | null;

export type FieldSpec = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
  half?: boolean;
  checkbox?: boolean;
  defaultChecked?: boolean;
};

/**
 * A form bound to a server action that returns { ok, message, fields }.
 * Renders labelled inputs, per-field errors and a live status message.
 */
export function ActionForm({
  action,
  fields,
  submitLabel,
  pendingLabel = 'Saving…',
  hidden = {},
  resetOnSuccess = false,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: FieldSpec[];
  submitLabel: string;
  pendingLabel?: string;
  hidden?: Record<string, string>;
  resetOnSuccess?: boolean;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok && resetOnSuccess) form.current?.reset();
    const firstBad = state.fields && Object.keys(state.fields)[0];
    if (firstBad) form.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
  }, [state, resetOnSuccess]);

  return (
    <form ref={form} action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((f) => {
        const err = state?.fields?.[f.name];
        const id = `f-${f.name}`;
        if (f.checkbox)
          return (
            <label key={f.name} className="flex cursor-pointer items-center gap-3 text-[0.9375rem] sm:col-span-2">
              <input type="checkbox" name={f.name} defaultChecked={f.defaultChecked} className="h-4 w-4 accent-[var(--ink)]" />
              {f.label}
            </label>
          );
        return (
          <div key={f.name} className={`field ${f.half ? '' : 'sm:col-span-2'}`}>
            <label htmlFor={id}>
              {f.label}
              {f.required === false && <span className="font-normal text-mute"> (optional)</span>}
            </label>
            {f.options ? (
              <select id={id} name={f.name} className="input" defaultValue={f.defaultValue} autoComplete={f.autoComplete} aria-invalid={!!err}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={f.name}
                type={f.type ?? 'text'}
                className="input"
                defaultValue={f.defaultValue}
                autoComplete={f.autoComplete}
                required={f.required !== false}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-err` : f.hint ? `${id}-hint` : undefined}
              />
            )}
            {f.hint && !err && (
              <span id={`${id}-hint`} className="small font-normal text-mute">
                {f.hint}
              </span>
            )}
            {err && (
              <span id={`${id}-err`} className="field-error" role="alert">
                {err}
              </span>
            )}
          </div>
        );
      })}
      {children && <div className="sm:col-span-2">{children}</div>}
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        <p aria-live="polite" className={`text-[0.9375rem] ${state?.ok ? 'text-ok' : 'text-danger'}`}>
          {state && (!state.fields || state.ok) ? state.message : ''}
        </p>
      </div>
    </form>
  );
}
