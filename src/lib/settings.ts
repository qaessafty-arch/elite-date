import { cache } from 'react';
import { query } from './db';

export type StoreSettings = {
  brand: { name: string; tagline: string; description: string; logoUrl: string | null };
  locale: { currency: string; locale: string };
  announcement: { enabled: boolean; messages: string[] };
  shipping: { countries: string[] };
  tax: { ratePercent: number; label: string };
  payments: { stripe: boolean; demo: boolean };
  contact: { email: string; phone: string; address: string; hours: string };
  social: { instagram: string; tiktok: string; pinterest: string };
  theme: { defaultTheme: 'light' | 'dark' };
};

export const DEFAULT_SETTINGS: StoreSettings = {
  brand: {
    name: 'Halden',
    tagline: 'Clothes cut to be kept',
    description:
      'Halden makes a small wardrobe of coats, shirts, denim and knitwear in mill-end cloth, cut in small runs and built to be worn for years.',
    logoUrl: null,
  },
  locale: { currency: 'USD', locale: 'en-US' },
  announcement: {
    enabled: true,
    messages: [
      'Free standard shipping on orders over $200',
      'Low Sun, the autumn collection, is here',
      'Returns are free for 30 days',
    ],
  },
  shipping: { countries: ['US', 'CA', 'GB', 'DE', 'FR', 'NL', 'SE', 'AU'] },
  tax: { ratePercent: 8, label: 'Estimated tax' },
  payments: { stripe: true, demo: true },
  contact: {
    email: 'care@halden.example',
    phone: '+1 (555) 010-0142',
    address: '14 Quarry Lane, Hudson, NY 12534',
    hours: 'Monday to Friday, 9am to 6pm ET',
  },
  social: {
    instagram: 'https://instagram.com/',
    tiktok: 'https://tiktok.com/',
    pinterest: 'https://pinterest.com/',
  },
  theme: { defaultTheme: 'light' },
};

export const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof StoreSettings)[];

/** Store settings merged over defaults. Deduplicated per request. */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  const rows = await query<{ key: string; value: unknown }>('select key, value from settings');
  const merged = structuredClone(DEFAULT_SETTINGS) as Record<string, unknown>;
  for (const row of rows) {
    if (row.key in merged && row.value && typeof row.value === 'object') {
      merged[row.key] = { ...(merged[row.key] as object), ...(row.value as object) };
    }
  }
  return merged as StoreSettings;
});

export async function saveSetting<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]): Promise<void> {
  await query(
    `insert into settings (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  NL: 'Netherlands',
  SE: 'Sweden',
  AU: 'Australia',
  IE: 'Ireland',
  ES: 'Spain',
  IT: 'Italy',
  DK: 'Denmark',
  NO: 'Norway',
  JP: 'Japan',
};

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}
