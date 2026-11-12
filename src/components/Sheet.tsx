'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Icon } from './Icon';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal panel that slides in from an edge. Traps focus, closes on Escape or
 * backdrop click, locks page scroll, and returns focus to the opener.
 */
export function Sheet({
  open,
  onClose,
  title,
  side = 'right',
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: 'left' | 'right' | 'top' | 'bottom';
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const nodes = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  const hidden =
    side === 'right' ? { x: '100%' } : side === 'left' ? { x: '-100%' } : side === 'top' ? { y: '-100%' } : { y: '100%' };
  const position =
    side === 'right'
      ? `right-0 top-0 h-dvh w-full ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`
      : side === 'left'
        ? 'left-0 top-0 h-dvh w-full max-w-sm'
        : side === 'top'
          ? 'inset-x-0 top-0 max-h-dvh'
          : 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-lg';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`absolute flex flex-col bg-paper text-ink shadow-2xl ${position}`}
            initial={reduce ? { opacity: 0 } : hidden}
            animate={reduce ? { opacity: 1 } : { x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : hidden}
            transition={{ duration: 0.38, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
              <h2 className="display display-sm">{title}</h2>
              <button type="button" className="icon-btn -mr-2" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
                <Icon name="close" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {footer && <div className="shrink-0 border-t border-line">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
