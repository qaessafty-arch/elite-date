import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { getSettings, siteUrl } from '@/lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await getSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${brand.name}. ${brand.tagline}`, template: `%s | ${brand.name}` },
    description: brand.description,
    openGraph: {
      type: 'website',
      siteName: brand.name,
      title: `${brand.name}. ${brand.tagline}`,
      description: brand.description,
      images: [{ url: '/images/campaign/hero.jpg', width: 2048, height: 1152, alt: `${brand.name} autumn campaign` }],
    },
    twitter: { card: 'summary_large_image' },
    icons: { icon: '/icon.svg' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The visitor's theme choice lives in a cookie so the server can render it with no flash and no inline script.
  const [{ theme }, jar] = await Promise.all([getSettings(), cookies()]);
  const saved = jar.get('theme')?.value;
  const active = saved === 'dark' || saved === 'light' ? saved : theme.defaultTheme;
  return (
    <html lang="en" data-theme={active}>
      <body>{children}</body>
    </html>
  );
}
