import Link from 'next/link';
import type { StoreSettings } from '@/lib/settings';
import { NewsletterForm } from './NewsletterForm';
import { ThemeToggle } from './ThemeToggle';

const PAYMENT_METHODS = ['Visa', 'Mastercard', 'American Express', 'Apple Pay', 'Google Pay'];

export function Footer({ settings }: { settings: StoreSettings }) {
  const { brand, contact, social } = settings;
  const columns = [
    {
      title: 'Customer care',
      links: [
        ['Contact us', '/help/contact'],
        ['Track an order', '/track'],
        ['Shipping', '/help/shipping'],
        ['Returns and exchanges', '/help/returns'],
        ['Size guide', '/help/size-guide'],
      ],
    },
    {
      title: 'Shop',
      links: [
        ['New arrivals', '/c/new-arrivals'],
        ['Women', '/c/women'],
        ['Men', '/c/men'],
        ['Collections', '/collections'],
        ['Sale', '/sale'],
      ],
    },
    {
      title: brand.name,
      links: [
        ['Our story', '/about'],
        ['Your account', '/account'],
        ['Wishlist', '/wishlist'],
        ['Privacy policy', '/help/privacy'],
        ['Terms and conditions', '/help/terms'],
      ],
    },
  ] as const;

  return (
    <footer className="mt-24 bg-loden text-on-dark">
      <div className="shell grid gap-12 py-16 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <h2 className="display display-md max-w-md">Letters from the cutting room</h2>
          <p className="mt-3 max-w-md text-on-dark/75">
            New pieces, restocks and the occasional long read about cloth. About twice a month.
          </p>
          <NewsletterForm />
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7 lg:pl-10">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="label mb-4 text-on-dark/60">{col.title}</h3>
              <ul className="grid gap-2.5 text-[0.9375rem]">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-brass">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="shell grid gap-8 border-t border-white/10 py-10 md:grid-cols-3">
        <div>
          <p className="display text-2xl uppercase tracking-[0.14em]">{brand.name}</p>
          <p className="small mt-3 max-w-xs text-on-dark/70">{brand.description}</p>
        </div>
        <address className="small not-italic text-on-dark/75">
          <p className="label mb-2 text-on-dark/60">Contact</p>
          <a href={`mailto:${contact.email}`} className="block hover:text-brass">
            {contact.email}
          </a>
          <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="block hover:text-brass">
            {contact.phone}
          </a>
          <p>{contact.address}</p>
          <p>{contact.hours}</p>
        </address>
        <div className="small text-on-dark/75">
          <p className="label mb-2 text-on-dark/60">Follow</p>
          <ul className="flex gap-5">
            {(
              [
                ['Instagram', social.instagram],
                ['TikTok', social.tiktok],
                ['Pinterest', social.pinterest],
              ] as const
            )
              .filter(([, url]) => url)
              .map(([name, url]) => (
                <li key={name}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-brass">
                    {name}
                  </a>
                </li>
              ))}
          </ul>
          <p className="label mb-2 mt-6 text-on-dark/60">We accept</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Accepted payment methods">
            {PAYMENT_METHODS.map((m) => (
              <li key={m} className="rounded-[2px] border border-white/20 px-2 py-1 text-xs">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="shell flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-5 text-xs text-on-dark/60">
        <p>
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
        <ThemeToggle />
      </div>
    </footer>
  );
}
