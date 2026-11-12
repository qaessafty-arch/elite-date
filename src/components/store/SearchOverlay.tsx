'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { useStore } from './StoreProvider';

type Suggestions = {
  products: { slug: string; name: string; priceCents: number; compareAtCents: number | null; image: string | null }[];
  categories: { slug: string; name: string; kind: string }[];
};

const RECENT_KEY = 'recent-searches';

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(term: string) {
  const t = term.trim();
  if (!t) return;
  try {
    const next = [t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export function SearchOverlay({ popular }: { popular: { slug: string; name: string }[] }) {
  const { searchOpen, setSearchOpen, money } = useStore();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [data, setData] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setRecent(readRecent());
      setActive(-1);
    } else {
      setQ('');
      setData(null);
    }
  }, [searchOpen]);

  // Global shortcut: "/" opens search unless the user is typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setSearchOpen]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          setData(await res.json());
          setActive(-1);
        }
      } catch {
        /* aborted */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Flat list of everything the arrow keys can reach.
  const options = useMemo(() => {
    if (data)
      return [
        ...data.categories.map((c) => ({ href: `/c/${c.slug}`, label: c.name })),
        ...data.products.map((p) => ({ href: `/products/${p.slug}`, label: p.name })),
      ];
    return recent.map((r) => ({ href: `/search?q=${encodeURIComponent(r)}`, label: r }));
  }, [data, recent]);

  const go = (href: string, term?: string) => {
    if (term) rememberSearch(term);
    setSearchOpen(false);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && options[active]) go(options[active].href, data ? q : options[active].label);
      else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`, q);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const term = q.trim();
  const noResults = !!data && !loading && data.products.length === 0 && data.categories.length === 0;
  let optionIndex = -1;
  const optionProps = () => {
    optionIndex += 1;
    const i = optionIndex;
    return { id: `search-opt-${i}`, role: 'option' as const, 'aria-selected': active === i, 'data-active': active === i };
  };

  return (
    <Sheet open={searchOpen} onClose={() => setSearchOpen(false)} title="Search" side="top">
      <div className="shell py-6 md:py-8">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (term) go(`/search?q=${encodeURIComponent(term)}`, term);
          }}
          className="flex items-center gap-3 border-b border-ink pb-3"
        >
          <Icon name="search" className="shrink-0 text-mute" />
          <input
            data-autofocus
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search coats, denim, hoodies"
            aria-label="Search products"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls="search-results"
            aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
            autoComplete="off"
            maxLength={80}
            className="display w-full bg-transparent text-2xl outline-none placeholder:text-mute/60 md:text-4xl [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" className="small shrink-0 underline underline-offset-4" onClick={() => setQ('')}>
              Clear
            </button>
          )}
        </form>

        <div id="search-results" ref={listRef} role="listbox" aria-label="Suggestions" className="mt-6 min-h-40">
          {!data && term.length < 2 && (
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <p className="label mb-3 text-mute">Recent searches</p>
                {recent.length ? (
                  <ul className="grid gap-1">
                    {recent.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          {...optionProps()}
                          onClick={() => go(`/search?q=${encodeURIComponent(r)}`, r)}
                          className="w-full rounded-[2px] px-2 py-2 text-left hover:bg-sand data-[active=true]:bg-sand"
                        >
                          {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-mute">Your recent searches will show up here.</p>
                )}
              </div>
              <div>
                <p className="label mb-3 text-mute">Popular collections</p>
                <ul className="flex flex-wrap gap-2">
                  {popular.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/c/${c.slug}`} onClick={() => setSearchOpen(false)} className="btn btn-secondary btn-sm">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {term.length >= 2 && !data && loading && <p className="text-mute">Searching…</p>}

          {noResults && (
            <div>
              <p className="display display-sm">Nothing matches “{term}”.</p>
              <p className="mt-2 text-mute">Check the spelling, try a broader word like “jacket”, or browse a collection.</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {popular.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/c/${c.slug}`} onClick={() => setSearchOpen(false)} className="btn btn-secondary btn-sm">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data && !noResults && (
            <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
              {data.categories.length > 0 && (
                <div>
                  <p className="label mb-3 text-mute">Categories</p>
                  <ul className="grid gap-1">
                    {data.categories.map((c) => (
                      <li key={c.slug}>
                        <button
                          type="button"
                          {...optionProps()}
                          onClick={() => go(`/c/${c.slug}`, term)}
                          className="w-full rounded-[2px] px-2 py-2 text-left hover:bg-sand data-[active=true]:bg-sand"
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={data.categories.length ? '' : 'md:col-span-2'}>
                <p className="label mb-3 text-mute">Products</p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {data.products.map((p) => (
                    <li key={p.slug}>
                      <button
                        type="button"
                        {...optionProps()}
                        onClick={() => go(`/products/${p.slug}`, term)}
                        className="flex w-full items-center gap-4 rounded-[2px] p-2 text-left hover:bg-sand data-[active=true]:bg-sand"
                      >
                        <span className="relative block h-20 w-16 shrink-0 overflow-hidden bg-sand">
                          {p.image && <Image src={p.image} alt="" fill sizes="64px" className="object-cover" />}
                        </span>
                        <span>
                          <span className="block font-medium">{p.name}</span>
                          <span className="small text-mute">
                            {money(p.priceCents)}
                            {p.compareAtCents ? <s className="ml-2">{money(p.compareAtCents)}</s> : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="link mt-5 font-medium" onClick={() => go(`/search?q=${encodeURIComponent(term)}`, term)}>
                  See all results for “{term}”
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
