'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const ClothCanvas = dynamic(() => import('./ClothCanvas'), { ssr: false });

export const CLOTHS = [
  {
    key: 'melton',
    name: 'Wool melton',
    color: '#b8895a',
    weave: 0,
    weight: '540 g/m²',
    origin: 'Biella, Italy',
    note: 'Fulled until the weave closes up, so wind and light rain stay out. Used in the Arden overcoat.',
  },
  {
    key: 'twill',
    name: 'Cotton twill',
    color: '#59613f',
    weave: 1,
    weight: '340 g/m²',
    origin: 'Prato, Italy',
    note: 'A steep diagonal rib that softens and fades along the seams. Used in the Field chore jacket.',
  },
  {
    key: 'denim',
    name: 'Selvedge denim',
    color: '#27365c',
    weave: 2,
    weight: '14 oz',
    origin: 'Okayama, Japan',
    note: 'Indigo warp over an undyed weft, woven slowly on shuttle looms. Used in the Selvedge straight jean.',
  },
] as const;

/**
 * Interactive cloth swatch. The 3D bundle (three.js) is only fetched when the
 * section approaches the viewport, and the swatch is a procedural illustration
 * of each weave, not a scan of a garment.
 */
export function ClothStudy() {
  const [active, setActive] = useState(0);
  const [near, setNear] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const cloth = CLOTHS[active];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} aria-labelledby="cloth-heading" className="shell grid items-center gap-10 pt-28 md:grid-cols-12 md:gap-8 md:pt-44">
      <div className="md:col-span-5">
        <h2 id="cloth-heading" className="display display-lg">
          Start with the cloth
        </h2>
        <p className="lede mt-4">Three of the fabrics we return to every season. Pick one, then drag the swatch to turn it in the light.</p>

        <div role="tablist" aria-label="Fabrics" className="mt-8 flex flex-wrap gap-2">
          {CLOTHS.map((c, i) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              id={`cloth-tab-${c.key}`}
              aria-selected={i === active}
              aria-controls="cloth-panel"
              onClick={() => setActive(i)}
              className={`inline-flex min-h-11 items-center gap-2.5 rounded-[2px] border px-3.5 text-[0.9375rem] font-medium transition-colors ${
                i === active ? 'border-ink bg-ink text-bone' : 'border-line-strong hover:border-ink'
              }`}
            >
              <span className="h-3.5 w-3.5 rounded-full border border-white/30" style={{ backgroundColor: c.color }} aria-hidden="true" />
              {c.name}
            </button>
          ))}
        </div>

        <div id="cloth-panel" role="tabpanel" aria-labelledby={`cloth-tab-${cloth.key}`} className="mt-6">
          <dl className="grid max-w-sm grid-cols-2 gap-4 border-y border-line py-4">
            <div>
              <dt className="small text-mute">Weight</dt>
              <dd className="display text-2xl">{cloth.weight}</dd>
            </div>
            <div>
              <dt className="small text-mute">Woven in</dt>
              <dd className="display text-2xl">{cloth.origin}</dd>
            </div>
          </dl>
          <p className="mt-4 max-w-sm text-mute">{cloth.note}</p>
        </div>
      </div>

      <div className="md:col-span-6 md:col-start-7">
        <div className="relative aspect-square overflow-hidden bg-sand md:aspect-[5/4]">
          {near && <ClothCanvas color={cloth.color} weave={cloth.weave} label={`Rotating swatch of ${cloth.name.toLowerCase()}`} />}
        </div>
        <p className="small mt-2 text-mute">Procedural illustration of the weave. Drag to rotate.</p>
      </div>
    </section>
  );
}
