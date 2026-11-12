'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { useStore } from './StoreProvider';

export type NavData = {
  departments: { slug: string; name: string }[];
  types: { slug: string; name: string }[];
  collections: { slug: string; name: string; description: string; imageUrl: string | null }[];
};

type MenuKey = string | null;

export function Header({ nav, signedIn }: { nav: NavData; signedIn: boolean }) {
  const { cart, openCart, setSearchOpen, wishlist, brandName } = useStore();
  const pathname = usePathname();
  const [menu, setMenu] = useState<MenuKey>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    setMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
        root.current?.querySelector<HTMLElement>(`[data-menu-trigger="${menu}"]`)?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [menu]);

  const hoverOpen = (key: MenuKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenu(key);
  };
  const hoverClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenu(null), 140);
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const linkClass = (active: boolean) =>
    `relative flex h-full items-center px-3 text-[0.9375rem] font-medium transition-colors hover:text-brass-deep ${
      active ? 'after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-ink' : ''
    }`;

  const department = nav.departments.find((d) => d.slug === menu);

  return (
    <header
      ref={root}
      className={`sticky top-0 z-50 border-b bg-bone/95 backdrop-blur transition-[border-color] duration-300 ${
        scrolled || menu ? 'border-line' : 'border-transparent'
      }`}
      onMouseLeave={hoverClose}
    >
      <div className="shell flex h-[var(--header-h)] items-center gap-2">
        <button
          type="button"
          className="icon-btn -ml-2 lg:hidden"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <Icon name="menu" />
        </button>

        <Link
          href="/"
          className="display mr-4 text-[1.625rem] uppercase tracking-[0.14em] lg:mr-8"
          aria-label={`${brandName} home`}
        >
          {brandName}
        </Link>

        <nav aria-label="Main" className="hidden h-full lg:block">
          <ul className="flex h-full items-stretch">
            <li>
              <Link href="/c/new-arrivals" className={linkClass(isActive('/c/new-arrivals'))} onMouseEnter={() => hoverOpen(null)}>
                New arrivals
              </Link>
            </li>
            {nav.departments.map((d) => (
              <li key={d.slug} onMouseEnter={() => hoverOpen(d.slug)}>
                <div className="flex h-full items-stretch">
                  <Link href={`/c/${d.slug}`} className={linkClass(isActive(`/c/${d.slug}`))}>
                    {d.name}
                  </Link>
                  <button
                    type="button"
                    data-menu-trigger={d.slug}
                    className="-ml-2 flex items-center px-1 text-mute hover:text-ink"
                    aria-expanded={menu === d.slug}
                    aria-controls="mega-menu"
                    aria-label={`${d.name} menu`}
                    onClick={() => setMenu(menu === d.slug ? null : d.slug)}
                  >
                    <Icon name="chevronDown" size={14} className={`transition-transform ${menu === d.slug ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </li>
            ))}
            <li onMouseEnter={() => hoverOpen('collections')}>
              <div className="flex h-full items-stretch">
                <Link href="/collections" className={linkClass(isActive('/collections'))}>
                  Collections
                </Link>
                <button
                  type="button"
                  data-menu-trigger="collections"
                  className="-ml-2 flex items-center px-1 text-mute hover:text-ink"
                  aria-expanded={menu === 'collections'}
                  aria-controls="mega-menu"
                  aria-label="Collections menu"
                  onClick={() => setMenu(menu === 'collections' ? null : 'collections')}
                >
                  <Icon name="chevronDown" size={14} className={`transition-transform ${menu === 'collections' ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </li>
            <li>
              <Link
                href="/sale"
                className={`${linkClass(isActive('/sale'))} text-brass-deep`}
                onMouseEnter={() => hoverOpen(null)}
              >
                Sale
              </Link>
            </li>
          </ul>
        </nav>

        <div className="ml-auto flex items-center">
          <button type="button" className="icon-btn" aria-label="Search" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
          </button>
          <Link href={signedIn ? '/account' : '/account/login'} className="icon-btn hidden sm:inline-grid" aria-label={signedIn ? 'Your account' : 'Sign in'}>
            <Icon name="user" />
          </Link>
          <Link href="/wishlist" className="icon-btn relative hidden sm:inline-grid" aria-label={`Wishlist, ${wishlist.size} saved`}>
            <Icon name="heart" />
            {wishlist.size > 0 && <Count n={wishlist.size} />}
          </Link>
          <button type="button" className="icon-btn relative -mr-2" aria-label={`Shopping bag, ${cart.itemCount} items`} onClick={openCart}>
            <Icon name="bag" />
            {cart.itemCount > 0 && <Count n={cart.itemCount} />}
          </button>
        </div>
      </div>

      {/* Desktop mega menu */}
      <div
        id="mega-menu"
        hidden={!menu}
        className="absolute inset-x-0 top-full hidden border-b border-line bg-bone shadow-[0_24px_40px_-24px_rgba(0,0,0,0.25)] lg:block"
        onMouseEnter={() => hoverOpen(menu)}
      >
        {department && (
          <div className="shell grid grid-cols-12 gap-8 py-10">
            <div className="col-span-3">
              <p className="label mb-4 text-mute">Shop {department.name.toLowerCase()}</p>
              <ul className="grid gap-2.5">
                <li>
                  <Link href={`/c/${department.slug}`} className="link font-medium">
                    Everything for {department.name.toLowerCase()}
                  </Link>
                </li>
                {nav.types.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/c/${department.slug}?type=${t.slug}`} className="hover:text-brass-deep">
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-3">
              <p className="label mb-4 text-mute">Collections</p>
              <ul className="grid gap-2.5">
                {nav.collections.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/c/${c.slug}?department=${department.slug}`} className="hover:text-brass-deep">
                      {c.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href={`/sale?department=${department.slug}`} className="text-brass-deep hover:underline">
                    Sale
                  </Link>
                </li>
              </ul>
            </div>
            <div className="col-span-6 grid grid-cols-2 gap-5">
              {nav.collections.slice(0, 2).map((c) => (
                <MenuTile key={c.slug} href={`/c/${c.slug}?department=${department.slug}`} title={c.name} image={c.imageUrl} text={c.description} />
              ))}
            </div>
          </div>
        )}
        {menu === 'collections' && (
          <div className="shell grid grid-cols-3 gap-5 py-10 xl:grid-cols-6">
            {nav.collections.map((c) => (
              <MenuTile key={c.slug} href={`/c/${c.slug}`} title={c.name} image={c.imageUrl} text={c.description} compact />
            ))}
          </div>
        )}
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu" side="left">
        <nav aria-label="Mobile" className="px-5 py-4">
          <Link href="/c/new-arrivals" className="block border-b border-line py-4 text-lg font-medium">
            New arrivals
          </Link>
          {nav.departments.map((d) => (
            <details key={d.slug} className="group border-b border-line">
              <summary className="flex list-none items-center justify-between py-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {d.name}
                <Icon name="plus" size={18} className="transition-transform group-open:rotate-45" />
              </summary>
              <ul className="grid gap-3 pb-5 pl-1 text-mute">
                <li>
                  <Link href={`/c/${d.slug}`} className="text-ink underline underline-offset-4">
                    Everything for {d.name.toLowerCase()}
                  </Link>
                </li>
                {nav.types.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/c/${d.slug}?type=${t.slug}`}>{t.name}</Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <details className="group border-b border-line">
            <summary className="flex list-none items-center justify-between py-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
              Collections
              <Icon name="plus" size={18} className="transition-transform group-open:rotate-45" />
            </summary>
            <ul className="grid gap-3 pb-5 pl-1 text-mute">
              <li>
                <Link href="/collections" className="text-ink underline underline-offset-4">
                  All collections
                </Link>
              </li>
              {nav.collections.map((c) => (
                <li key={c.slug}>
                  <Link href={`/c/${c.slug}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </details>
          <Link href="/sale" className="block border-b border-line py-4 text-lg font-medium text-brass-deep">
            Sale
          </Link>
          <div className="mt-6 grid gap-4 text-[0.9375rem]">
            <Link href={signedIn ? '/account' : '/account/login'} className="flex items-center gap-3">
              <Icon name="user" /> {signedIn ? 'Your account' : 'Sign in or create an account'}
            </Link>
            <Link href="/wishlist" className="flex items-center gap-3">
              <Icon name="heart" /> Wishlist{wishlist.size > 0 ? ` (${wishlist.size})` : ''}
            </Link>
            <Link href="/track" className="flex items-center gap-3">
              <Icon name="truck" /> Track an order
            </Link>
          </div>
        </nav>
      </Sheet>
    </header>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute right-0.5 top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-ink px-1 text-[0.6875rem] font-semibold leading-none text-bone">
      {n > 99 ? '99+' : n}
    </span>
  );
}

function MenuTile({
  href,
  title,
  text,
  image,
  compact = false,
}: {
  href: string;
  title: string;
  text: string;
  image: string | null;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <div className={`relative overflow-hidden bg-sand ${compact ? 'aspect-[3/4]' : 'aspect-[4/5]'}`}>
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes={compact ? '(min-width: 1280px) 14vw, 30vw' : '22vw'}
            className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.04]"
          />
        )}
      </div>
      <p className="mt-3 font-medium group-hover:text-brass-deep">{title}</p>
      {!compact && <p className="small text-mute">{text}</p>}
    </Link>
  );
}
