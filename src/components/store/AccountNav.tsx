'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/account', 'Overview'],
  ['/account/orders', 'Orders'],
  ['/account/addresses', 'Addresses'],
  ['/wishlist', 'Wishlist'],
  ['/account/settings', 'Profile and password'],
] as const;

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="mt-5">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line md:block md:border-0">
        {LINKS.map(([href, label]) => {
          const active = href === '/account' ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`block whitespace-nowrap px-3 py-2.5 text-[0.9375rem] md:border-l-2 md:px-4 md:py-2 ${
                  active ? 'border-b-2 border-ink font-semibold md:border-b-0 md:border-l-ink' : 'border-transparent text-mute hover:text-ink md:border-l-line'
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
