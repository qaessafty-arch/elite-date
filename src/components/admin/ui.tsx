'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useFormAction } from '@/components/useFormAction';
import type { ActionState } from '@/components/ActionForm';
import { Icon } from '@/components/Icon';

export type NavItem = { href: string; label: string };

export function AdminNav({ items, footer }: { items: NavItem[]; footer: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const list = (
    <ul className="grid gap-0.5">
      {items.map((i) => {
        const active = i.href === '/admin' ? pathname === '/admin' : pathname.startsWith(i.href);
        return (
          <li key={i.href}>
            <Link
              href={i.href}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`block rounded-[2px] px-3 py-2 text-[0.9375rem] ${active ? 'bg-ink font-semibold text-bone' : 'hover:bg-sand'}`}
            >
              {i.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-3 lg:hidden">
        <Link href="/admin" className="display text-xl uppercase tracking-[0.14em]">
          Admin
        </Link>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} aria-controls="admin-nav-mobile" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'close' : 'menu'} size={16} /> Menu
        </button>
      </div>
      <nav id="admin-nav-mobile" aria-label="Admin" hidden={!open} className="border-b border-line bg-paper px-4 py-4 lg:hidden">
        {list}
        <div className="mt-4 border-t border-line pt-4">{footer}</div>
      </nav>
      <aside className="hidden w-56 shrink-0 border-r border-line bg-paper lg:block">
        <div className="sticky top-0 flex h-dvh flex-col px-4 py-6">
          <Link href="/admin" className="display px-3 text-2xl uppercase tracking-[0.14em]">
            Admin
          </Link>
          <nav aria-label="Admin" className="mt-8 flex-1 overflow-y-auto">
            {list}
          </nav>
          <div className="border-t border-line pt-4">{footer}</div>
        </div>
      </aside>
    </>
  );
}

/** Compact one-row form (stock, image meta, status) bound to an action returning ActionState. */
export function RowForm({
  action,
  hidden,
  children,
  label = 'Save',
  className = 'flex flex-wrap items-end gap-2',
  variant = 'btn-secondary',
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
  label?: string;
  className?: string;
  variant?: string;
}) {
  const { state, pending, onSubmit } = useFormAction(action, null);
  const form = useRef<HTMLFormElement>(null);
  // Clear file inputs and "add" forms once the server has accepted them.
  useEffect(() => {
    if (state?.ok && form.current?.querySelector('input[type=file], [data-reset]')) form.current.reset();
  }, [state]);
  return (
    <form ref={form} onSubmit={onSubmit} className={className}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <button type="submit" className={`btn btn-sm ${variant}`} disabled={pending}>
        {pending ? 'Saving…' : label}
      </button>
      <span aria-live="polite" className={`small basis-full ${state?.ok ? 'text-ok' : 'text-danger'}`}>
        {state?.fields ? Object.values(state.fields)[0] : state?.message}
      </span>
    </form>
  );
}

/** Submit button that asks before a destructive action. */
export function ConfirmButton({ message, children, className = 'small text-danger underline underline-offset-4' }: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
