import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Our story',
  description: 'Why Halden makes a small wardrobe in mill-end cloth, and how the pieces are made.',
  alternates: { canonical: '/about' },
};

export default async function AboutPage() {
  const { brand } = await getSettings();
  return (
    <>
      <div className="shell pb-6 pt-10 md:pt-16">
        <h1 className="display display-xl max-w-[12ch]">Clothes cut to be kept</h1>
      </div>
      <div className="relative mt-6 aspect-[16/9] max-h-[42rem] w-full overflow-hidden bg-sand">
        <Image src="/images/campaign/low-sun.jpg" alt="Two people in Halden outerwear on concrete steps at dusk" fill priority sizes="100vw" className="object-cover" />
      </div>
      <div className="shell grid gap-12 pt-16 md:grid-cols-12 md:pt-24">
        <div className="md:col-span-5">
          <p className="display display-md">{brand.name} makes fewer things, and keeps making them.</p>
        </div>
        <div className="grid gap-5 text-[1.0625rem] text-mute md:col-span-6 md:col-start-7">
          <p>Most clothing is designed to be replaced. A season ends, the colours change, the shop empties and fills again. We started {brand.name} to see what happens when you remove that pressure.</p>
          <p>The range is small on purpose: one overcoat, one chore jacket, one straight jean. Each year we adjust a seam, find a better button, change a mill. Nothing is dropped because it is last year’s.</p>
          <p>The cloth comes from the ends of rolls woven for other houses in Biella, Prato and Okayama. It is the same fabric, bought in the lengths that are left, which is why some colours appear once and do not come back.</p>
        </div>
      </div>
      <div className="shell grid gap-8 pt-16 md:grid-cols-2 md:pt-24">
        <div className="relative aspect-[4/5] overflow-hidden bg-sand">
          <Image src="/images/campaign/atelier.jpg" alt="Chalk marking a pattern onto wool" fill sizes="(min-width: 768px) 46vw, 92vw" className="object-cover" />
        </div>
        <div className="relative aspect-[4/5] overflow-hidden bg-sand md:mt-24">
          <Image src="/images/campaign/cloth.jpg" alt="Folded wool, twill and selvedge denim" fill sizes="(min-width: 768px) 46vw, 92vw" className="object-cover" />
        </div>
      </div>
      <div className="shell pt-16 md:pt-24">
        <h2 className="display display-lg">How a piece gets made</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-4">
          {[
            ['Find the cloth', 'We visit the mills twice a year and buy what is left of rolls we would have chosen anyway.'],
            ['Cut the pattern', 'Patterns are drafted by hand in our studio and graded across five sizes, then tested on real people.'],
            ['Sew a small run', 'Family workshops in Portugal and northern Italy sew each style in runs of 300 or fewer.'],
            ['Keep it going', 'We stock spare buttons and offer repairs, because the best piece is the one already in your wardrobe.'],
          ].map(([title, text], i) => (
            <li key={title} className="border-t border-ink pt-4">
              <p className="display text-3xl text-brass-deep">{i + 1}</p>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-1 text-mute">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/c/essentials" className="btn btn-primary">
            Shop the essentials
          </Link>
          <Link href="/collections" className="btn btn-secondary">
            See all collections
          </Link>
        </div>
      </div>
    </>
  );
}
