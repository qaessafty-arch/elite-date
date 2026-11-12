import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/settings';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/checkout', '/cart', '/orders', '/api', '/search', '/wishlist'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
