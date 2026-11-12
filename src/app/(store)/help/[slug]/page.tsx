import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SizeGuideTables } from '@/components/store/SizeGuide';
import { formatMoney } from '@/lib/money';
import { listShippingMethods } from '@/lib/orders';
import { COUNTRY_NAMES, getSettings } from '@/lib/settings';

const PAGES = {
  shipping: { title: 'Shipping', description: 'Delivery options, costs and times.' },
  returns: { title: 'Returns and exchanges', description: 'How to send something back within 30 days.' },
  'size-guide': { title: 'Size guide', description: 'Body measurements for tops, trousers and shoes.' },
  contact: { title: 'Contact us', description: 'How to reach customer care.' },
  privacy: { title: 'Privacy policy', description: 'What data we collect and how we use it.' },
  terms: { title: 'Terms and conditions', description: 'The terms that apply when you order.' },
} as const;
type Slug = keyof typeof PAGES;

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = PAGES[(await params).slug as Slug];
  return page ? { title: page.title, description: page.description, alternates: { canonical: `/help/${(await params).slug}` } } : {};
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-6">
      <h2 className="display display-sm">{title}</h2>
      <div className="mt-2 grid max-w-prose gap-3 text-mute">{children}</div>
    </section>
  );
}

export default async function HelpPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug as Slug;
  const page = PAGES[slug];
  if (!page) notFound();
  const settings = await getSettings();
  const { brand, contact } = settings;
  const money = (c: number) => formatMoney(c, settings.locale.currency, settings.locale.locale);
  const methods = slug === 'shipping' ? await listShippingMethods() : [];

  return (
    <div className="shell grid gap-10 pb-10 pt-8 md:grid-cols-[13rem_1fr] md:pt-12">
      <nav aria-label="Help topics">
        <ul className="no-scrollbar flex gap-1 overflow-x-auto md:block">
          {(Object.keys(PAGES) as Slug[]).map((s) => (
            <li key={s} className="shrink-0">
              <Link
                href={`/help/${s}`}
                aria-current={s === slug ? 'page' : undefined}
                className={`block whitespace-nowrap px-3 py-2 text-[0.9375rem] md:border-l-2 md:px-4 ${s === slug ? 'font-semibold md:border-ink' : 'text-mute hover:text-ink md:border-line'}`}
              >
                {PAGES[s].title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="grid max-w-3xl gap-8">
        <header>
          <h1 className="display display-lg">{page.title}</h1>
          <p className="lede mt-3">{page.description}</p>
        </header>

        {slug === 'shipping' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] border-collapse text-left text-[0.9375rem]">
                <thead>
                  <tr className="border-b border-ink">
                    <th scope="col" className="py-2 pr-4 font-semibold">Method</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Delivery time</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map((m) => (
                    <tr key={m.id} className="border-b border-line">
                      <th scope="row" className="py-3 pr-4 font-semibold">
                        {m.name}
                        <span className="small block font-normal text-mute">{m.description}</span>
                      </th>
                      <td className="py-3 pr-4 text-mute">{m.min_days === m.max_days ? m.min_days : `${m.min_days} to ${m.max_days}`} working days</td>
                      <td className="py-3 pr-4 text-mute">
                        {money(m.price_cents)}
                        {m.free_over_cents !== null && `, free over ${money(m.free_over_cents)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Section title="Where we ship">
              <p>We currently deliver to {settings.shipping.countries.map((c) => COUNTRY_NAMES[c] ?? c).join(', ')}.</p>
            </Section>
            <Section title="Tracking">
              <p>
                You get a tracking number by email when your parcel leaves us. You can also{' '}
                <Link href="/track" className="link text-ink">track an order</Link> with your order number and email.
              </p>
            </Section>
            <Section title="Duties and taxes">
              <p>Orders outside the United States may be charged import duties by the carrier on delivery. These are set by your local customs office and are not included in our prices.</p>
            </Section>
          </>
        )}

        {slug === 'returns' && (
          <>
            <Section title="30 days, free">
              <p>You can return unworn, unwashed pieces with their tags within 30 days of delivery for a full refund. Return shipping is free with the prepaid label we send you.</p>
            </Section>
            <Section title="How to return">
              <ol className="grid list-decimal gap-2 pl-5">
                <li>Email {contact.email} with your order number and what you are sending back.</li>
                <li>We reply with a prepaid label within one working day.</li>
                <li>Pack the pieces, attach the label and drop the parcel at the carrier.</li>
                <li>We refund your original payment method within five working days of receiving it.</li>
              </ol>
            </Section>
            <Section title="Exchanges">
              <p>For a different size or colour, tell us in your email and we will reserve it for you while your return travels.</p>
            </Section>
            <Section title="Faulty items">
              <p>If something arrives damaged or fails in normal wear, contact us at any time. We will repair it, replace it or refund you.</p>
            </Section>
          </>
        )}

        {slug === 'size-guide' && <SizeGuideTables />}

        {slug === 'contact' && (
          <>
            <Section title="Customer care">
              <p>
                Email <a href={`mailto:${contact.email}`} className="link text-ink">{contact.email}</a> or call{' '}
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="link text-ink">{contact.phone}</a>.
              </p>
              <p>{contact.hours}. We answer email within one working day.</p>
            </Section>
            <Section title="Studio">
              <address className="not-italic">{contact.address}</address>
              <p>Visits are by appointment.</p>
            </Section>
            <Section title="Faster answers">
              <p>
                <Link href="/track" className="link text-ink">Track an order</Link>, read about{' '}
                <Link href="/help/shipping" className="link text-ink">shipping</Link> and{' '}
                <Link href="/help/returns" className="link text-ink">returns</Link>, or check the{' '}
                <Link href="/help/size-guide" className="link text-ink">size guide</Link>.
              </p>
            </Section>
          </>
        )}

        {slug === 'privacy' && (
          <>
            <p className="notice">This is a starting template for a demonstration store. Have it reviewed by a lawyer before trading.</p>
            <Section title="What we collect">
              <p>When you order we collect your name, email, delivery address, phone number if you give it, and what you bought. If you create an account we also store a hashed password and your saved addresses and wishlist.</p>
            </Section>
            <Section title="Payments">
              <p>Card payments are handled by our payment provider on their own secure page. {brand.name} never sees or stores your card number.</p>
            </Section>
            <Section title="Cookies">
              <p>We use two essential cookies: one keeps you signed in, the other remembers your bag and wishlist. We do not use advertising cookies.</p>
            </Section>
            <Section title="Email">
              <p>We send order emails because they are needed to fulfil your order. Newsletter emails are only sent if you subscribe, and every one has an unsubscribe link.</p>
            </Section>
            <Section title="Your rights">
              <p>You can ask for a copy of your data, or ask us to correct or delete it, by emailing {contact.email}.</p>
            </Section>
          </>
        )}

        {slug === 'terms' && (
          <>
            <p className="notice">This is a starting template for a demonstration store. Have it reviewed by a lawyer before trading.</p>
            <Section title="Orders">
              <p>An order is accepted when we send your confirmation email. If we cannot fulfil it, for example because of a stock error, we will tell you and refund you in full.</p>
            </Section>
            <Section title="Prices">
              <p>Prices are shown in {settings.locale.currency} and exclude sales tax, which is calculated at checkout. Promo codes cannot be combined and have no cash value.</p>
            </Section>
            <Section title="Delivery and returns">
              <p>
                See the <Link href="/help/shipping" className="link text-ink">shipping</Link> and{' '}
                <Link href="/help/returns" className="link text-ink">returns</Link> pages, which form part of these terms.
              </p>
            </Section>
            <Section title="Contact">
              <p>{brand.name}, {contact.address}. {contact.email}.</p>
            </Section>
          </>
        )}
      </article>
    </div>
  );
}
