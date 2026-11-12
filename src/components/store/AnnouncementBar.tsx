'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Icon';

const KEY = 'announcement-dismissed';

/** Rotating promotional messages. Dismissal lasts for the browser session. */
export function AnnouncementBar({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === messages.join('|')) setHidden(true);
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (hidden || paused || messages.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), 5000);
    return () => clearInterval(t);
  }, [hidden, paused, messages.length]);

  if (hidden || !messages.length) return null;

  return (
    <div
      className="relative bg-loden text-on-dark"
      role="region"
      aria-label="Store announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="shell flex min-h-10 items-center justify-center py-2 pr-10 text-center text-[0.8125rem] font-medium">
        <p key={index} className="ticker-in" aria-live="off">
          {messages[index]}
        </p>
        <ul className="sr-only">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full hover:bg-white/10"
        aria-label="Dismiss announcements"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem(KEY, messages.join('|'));
          } catch {}
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
