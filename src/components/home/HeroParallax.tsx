'use client';

import { useEffect, useRef } from 'react';

/**
 * Wraps the hero image and drifts it slightly slower than the page on scroll.
 * GSAP is loaded on demand and skipped entirely for reduced-motion users.
 * It never intercepts scrolling; it only reads scroll position.
 */
export function HeroParallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        gsap.to(el, {
          yPercent: 9,
          ease: 'none',
          scrollTrigger: { trigger: el.parentElement, start: 'top top', end: 'bottom top', scrub: 0.4 },
        });
      });
      revert = () => ctx.revert();
    })();
    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 will-change-transform">
      {children}
    </div>
  );
}
