import type { Metadata, Viewport } from 'next';
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
  const { theme } = await getSettings();
  // Applies the saved theme before paint so there is no flash. Static string, no user input.
  const themeScript = `try{var t=localStorage.getItem('theme')||'${theme.defaultTheme === 'dark' ? 'dark' : 'light'}';document.documentElement.dataset.theme=t}catch(e){}`;
  return (
    <html lang="en" data-theme={theme.defaultTheme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
